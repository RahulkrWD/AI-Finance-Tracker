const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const Statement = require('../models/Statement');
const Transaction = require('../models/Transaction');
const pdfParse = require('pdf-parse');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const { OpenAI } = require('openai');

// Configure OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Check if API key is available
if (!process.env.OPENAI_API_KEY) {
  console.error('Warning: OPENAI_API_KEY is not set in environment variables');
}

// Process uploaded statements
router.post('/', async (req, res) => {
  try {
    const { fileIds } = req.body;
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ message: 'No file IDs provided' });
    }

    let totalTransactions = 0;
    
    // Process each file
    for (const fileId of fileIds) {
      // Get statement info from database
      const statement = await Statement.findById(fileId);
      
      if (!statement) {
        console.error(`Statement with ID ${fileId} not found`);
        continue;
      }
      
      // Update processing status
      statement.processingStatus = 'processing';
      await statement.save();
      
      try {
        // Get file path
        const filePath = path.join(__dirname, '../uploads', statement.filename);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${statement.filename}`);
        }
        
        // Extract text based on file type
        let extractedText;
        
        if (statement.fileType === 'pdf') {
          const pdfData = await readFile(filePath);
          const pdfResult = await pdfParse(pdfData);
          extractedText = pdfResult.text;
          
          if (!extractedText || extractedText.trim().length === 0) {
            throw new Error('No text could be extracted from PDF file');
          }
        } else if (statement.fileType === 'csv') {
          extractedText = await processCSV(filePath);
        } else if (statement.fileType === 'txt') {
          extractedText = await readFile(filePath, 'utf8');
          
          if (!extractedText || extractedText.trim().length === 0) {
            throw new Error('Text file is empty or could not be read');
          }
        } else if (statement.fileType === 'xls' || statement.fileType === 'xlsx') {
          extractedText = await processExcel(filePath);
        } else {
          throw new Error(`Unsupported file type: ${statement.fileType}`);
        }
        
        // Validate extracted text
        if (!extractedText || extractedText.trim().length < 10) {
          throw new Error('Insufficient text content for processing');
        }
        
        // Process text with AI
        const transactions = await processWithAI(extractedText, statement._id);
        
        // Save transactions to database
        if (transactions && transactions.length > 0) {
          await Transaction.insertMany(transactions);
          
          // Update statement with transaction count
          statement.transactionCount = transactions.length;
          statement.processed = true;
          statement.processingStatus = 'completed';
          await statement.save();
          
          totalTransactions += transactions.length;
        } else {
          statement.processingStatus = 'failed';
          statement.processed = false;
          await statement.save();
        }
      } catch (error) {
        console.error(`Error processing file ${statement.filename}:`, error);
        statement.processingStatus = 'failed';
        await statement.save();
      }
    }
    
    res.json({ 
      message: 'Processing complete', 
      transactionsCount: totalTransactions 
    });
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ message: 'Server error during processing', error: error.message });
  }
});

// Process Excel file (XLS/XLSX)
async function processExcel(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }

    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No worksheets found in Excel file');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { 
      header: 1, // Use array of arrays format
      defval: '' // Default value for empty cells
    });
    
    if (jsonData.length === 0) {
      throw new Error('No data found in Excel file');
    }
    
    // Convert to CSV-like format for AI processing
    const csvText = jsonData.map(row => row.join(',')).join('\n');
    
    return csvText;
  } catch (error) {
    console.error('Excel processing error:', error);
    throw new Error(`Failed to process Excel file: ${error.message}`);
  }
}

// Process CSV file
async function processCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      reject(new Error(`CSV file not found: ${filePath}`));
      return;
    }
    
    fs.createReadStream(filePath)
      .pipe(csv({
        skipEmptyLines: true,
        skipLinesWithError: true
      }))
      .on('data', (data) => {
        // Only add non-empty rows
        if (Object.keys(data).length > 0) {
          results.push(data);
        }
      })
      .on('end', () => {
        if (results.length === 0) {
          reject(new Error('No valid data found in CSV file'));
          return;
        }
        
        // Convert CSV data to a format that works with both AI and regex processing
        let formattedText = '';
        
        // Try to identify common CSV column patterns
        const firstRow = results[0];
        const columns = Object.keys(firstRow);
        
        // Common column name patterns
        const dateColumns = columns.filter(col => 
          /date|Date|DATE/i.test(col) || 
          /transaction.*date/i.test(col)
        );
        const descColumns = columns.filter(col => 
          /desc|description|Description|DESCRIPTION/i.test(col) ||
          /transaction.*desc/i.test(col) ||
          /memo|Memo|MEMO/i.test(col)
        );
        const amountColumns = columns.filter(col => 
          /amount|Amount|AMOUNT/i.test(col) ||
          /debit|Debit|DEBIT/i.test(col) ||
          /credit|Credit|CREDIT/i.test(col)
        );
        const typeColumns = columns.filter(col => 
          /type|Type|TYPE/i.test(col)
        );
        
        // Use the first matching column for each type
        const dateCol = dateColumns[0] || columns[0];
        const descCol = descColumns[0] || columns[1];
        const amountCol = amountColumns[0] || columns[2];
        const typeCol = typeColumns[0];
        
        // Check for separate debit/credit columns
        const debitCol = columns.find(col => /debit.*amount|Debit.*Amount/i.test(col));
        const creditCol = columns.find(col => /credit.*amount|Credit.*Amount/i.test(col));
        
        console.log('CSV columns detected:', { dateCol, descCol, amountCol, typeCol, debitCol, creditCol });
        
        // Format each row as a readable transaction line
        results.forEach(row => {
          try {
            let date = row[dateCol] || '';
            let description = row[descCol] || '';
            let amount = 0;
            let type = row[typeCol] || '';
            
            // Handle separate debit/credit columns
            if (debitCol && creditCol) {
              const debitAmount = parseFloat(row[debitCol] || 0);
              const creditAmount = parseFloat(row[creditCol] || 0);
              
              if (debitAmount > 0) {
                amount = -debitAmount; // Debits are negative
                type = type || 'Debit';
              } else if (creditAmount > 0) {
                amount = creditAmount; // Credits are positive
                type = type || 'Credit';
              }
            } else if (amountCol) {
              amount = parseFloat(row[amountCol] || 0);
              
              // If type column exists, use it to determine sign
              if (typeCol && type) {
                if (/debit|expense|withdrawal/i.test(type) && amount > 0) {
                  amount = -amount;
                } else if (/credit|income|deposit/i.test(type) && amount < 0) {
                  amount = Math.abs(amount);
                }
              }
            }
            
            // Format as a readable line for processing
            if (date && description && !isNaN(amount)) {
              formattedText += `${date},${description},${amount},${type}\n`;
            }
          } catch (error) {
            console.warn('Error processing CSV row:', row, error.message);
          }
        });
        
        if (formattedText.trim().length === 0) {
          reject(new Error('No valid transaction data could be extracted from CSV'));
          return;
        }
        
        console.log('Formatted CSV text length:', formattedText.length);
        resolve(formattedText);
      })
      .on('error', (error) => {
        console.error('CSV processing error:', error);
        reject(new Error(`Failed to process CSV file: ${error.message}`));
      });
  });
}

// Process text with AI
async function processWithAI(text, statementId) {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not configured, using fallback extraction');
      return extractTransactionsWithRegex(text, statementId);
    }

    console.log('Processing with AI, text length:', text.length);
    
    // Limit text to avoid token limits (approximately 15,000 characters)
    const limitedText = text.substring(0, 15000);
    
    const systemMessage = `You are an expert financial transaction extractor and categorizer. Extract transactions from bank statements and return them as a JSON array.

Each transaction should have:
- date: YYYY-MM-DD format
- description: clean transaction description
- amount: number (positive for income/deposits, negative for expenses/withdrawals)
- type: "income", "expense", or "transfer"
- category: one of these categories based on the transaction:
  * "food" - restaurants, groceries, food delivery
  * "transportation" - gas, uber, public transport, car payments
  * "utilities" - electricity, water, internet, phone bills
  * "entertainment" - movies, games, streaming services
  * "shopping" - retail purchases, clothing, electronics
  * "healthcare" - medical bills, pharmacy, insurance
  * "education" - tuition, books, courses
  * "housing" - rent, mortgage, home maintenance
  * "income" - salary, freelance, business income
  * "transfer" - bank transfers, ATM withdrawals
  * "other" - anything that doesn't fit above categories
- merchant: extract merchant/company name if identifiable

Example format:
[
  {
    "date": "2024-01-15",
    "description": "Salary Deposit - ABC Company",
    "amount": 5000.00,
    "type": "income",
    "category": "income",
    "merchant": "ABC Company"
  },
  {
    "date": "2024-01-16", 
    "description": "Walmart Grocery Purchase",
    "amount": -150.75,
    "type": "expense",
    "category": "food",
    "merchant": "Walmart"
  }
]

Return ONLY the JSON array, no other text.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: `Extract transactions from this bank statement:\n\n${limitedText}` }
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    let content = response.choices[0].message.content.trim();
    
    // Clean up the response - remove markdown formatting
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    console.log('AI Response:', content);

    // Try to parse JSON with multiple approaches
    let transactions;
    try {
      transactions = JSON.parse(content);
    } catch (parseError) {
      console.log('Direct JSON parse failed, trying regex extraction...');
      
      // Try to extract JSON array using regex
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          transactions = JSON.parse(jsonMatch[0]);
        } catch (regexParseError) {
          console.log('Regex JSON parse also failed, trying another approach...');
          
          // Try to find and fix common JSON issues
          let fixedContent = jsonMatch[0]
            .replace(/,\s*}/g, '}')  // Remove trailing commas
            .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
          
          transactions = JSON.parse(fixedContent);
        }
      } else {
        throw new Error('No valid JSON array found in AI response');
      }
    }

    if (!Array.isArray(transactions)) {
      throw new Error('AI response is not an array');
    }

    // Validate and clean transactions
    const validTransactions = transactions.filter(transaction => {
      // Check required fields
      if (!transaction.date || !transaction.description || transaction.amount === undefined) {
        console.warn('Transaction missing required fields:', transaction);
        return false;
      }
      
      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) {
        console.warn('Transaction has invalid date format:', transaction.date);
        return false;
      }
      
      // Validate amount is a number
      if (typeof transaction.amount !== 'number' || isNaN(transaction.amount)) {
        console.warn('Transaction has invalid amount:', transaction.amount);
        return false;
      }
      
      return true;
    }).map(transaction => {
      // Determine transaction type based on amount and AI suggestion
      let transactionType = 'expense';
      if (transaction.amount > 0) {
        transactionType = transaction.type === 'transfer' ? 'transfer' : 'income';
      } else if (transaction.type === 'transfer') {
        transactionType = 'transfer';
      }

      // Validate and set category
      const validCategories = [
        'food', 'transportation', 'utilities', 'entertainment', 'shopping',
        'healthcare', 'education', 'housing', 'income', 'transfer', 'other'
      ];
      const category = validCategories.includes(transaction.category) ? 
        transaction.category : 'other';

      return {
        date: transaction.date,
        description: transaction.description.trim(),
        amount: parseFloat(transaction.amount),
        type: transactionType,
        category: category,
        merchant: transaction.merchant || '',
        sourceFile: statementId,
        aiConfidence: 0.85,
        userModified: false
      };
    });

    console.log(`Extracted ${validTransactions.length} valid transactions from ${transactions.length} total`);
    
    return validTransactions;
  } catch (error) {
    console.error('AI processing error:', error);
    
    // Check if it's a quota/rate limit error
    if (error.status === 429 || error.code === 'insufficient_quota' || error.code === 'rate_limit_exceeded') {
      console.log('OpenAI quota exceeded, using fallback extraction');
    } else {
      console.log('AI processing failed, using fallback extraction');
    }
    
    return extractTransactionsWithRegex(text, statementId);
  }
}

// Fallback regex-based transaction extraction
function extractTransactionsWithRegex(text, statementId) {
  console.log('Using regex-based transaction extraction');
  
  const transactions = [];
  const lines = text.split('\n');
  
  // Common patterns for bank statements
  const patterns = [
    // Pattern 1: CSV format from processCSV function: Date,Description,Amount,Type
    /^([^,]+),([^,]+),([-+]?\d*\.?\d+),?(.*)$/,
    
    // Pattern 2: Date, Description, Amount (CSV style with optional dollar sign)
    /^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}),?\s*([^,\t]+),?\s*([-+]?\$?\d+\.?\d*)/,
    
    // Pattern 3: Date Description Amount (space separated)
    /^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\s+(.+?)\s+([-+]?\$?\d+\.?\d*)$/,
    
    // Pattern 4: Date followed by description and amount on same line
    /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})\s+(.+?)\s+([-+]?\$?\d+\.?\d*)\s*$/
  ];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 10) continue;
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = trimmedLine.match(pattern);
      if (match) {
        try {
          let dateStr, description, amountStr, typeStr;
          
          if (i === 0) {
            // CSV format: Date,Description,Amount,Type
            [, dateStr, description, amountStr, typeStr] = match;
          } else {
            // Other formats: Date, Description, Amount
            [, dateStr, description, amountStr] = match;
          }
          
          // Clean and parse date
          let date = parseDate(dateStr);
          if (!date) continue;
          
          // Clean description
          description = description.trim().replace(/[",]/g, '');
          if (!description || description.length < 3) continue;
          
          // Clean and parse amount
          amountStr = amountStr.replace(/[$,]/g, '');
          const amount = parseFloat(amountStr);
          if (isNaN(amount)) continue;
          
          // Basic categorization based on keywords
          const category = categorizeTransaction(description);
          const merchant = extractMerchant(description);
          
          // Determine type - use CSV type if available, otherwise infer from amount
          let type;
          if (typeStr && typeStr.trim()) {
            const csvType = typeStr.trim().toLowerCase();
            if (csvType.includes('credit') || csvType.includes('deposit') || amount > 0) {
              type = 'income';
            } else {
              type = 'expense';
            }
          } else {
            type = amount >= 0 ? 'income' : 'expense';
          }

          transactions.push({
            date: date,
            description: description,
            amount: amount,
            type: type,
            category: category,
            merchant: merchant,
            sourceFile: statementId,
            aiConfidence: 0.6,
            userModified: false
          });
          
          break; // Found a match, move to next line
        } catch (error) {
          console.warn('Error parsing line:', trimmedLine, error.message);
        }
      }
    }
  }
  
  console.log(`Regex extraction found ${transactions.length} transactions`);
  return transactions;
}

// Helper function to categorize transactions based on keywords
function categorizeTransaction(description) {
  const desc = description.toLowerCase();
  
  // Food & Dining
  if (desc.includes('restaurant') || desc.includes('food') || desc.includes('grocery') || 
      desc.includes('starbucks') || desc.includes('mcdonald') || desc.includes('pizza') ||
      desc.includes('cafe') || desc.includes('dining') || desc.includes('uber eats') ||
      desc.includes('doordash') || desc.includes('grubhub')) {
    return 'food';
  }
  
  // Transportation
  if (desc.includes('gas') || desc.includes('fuel') || desc.includes('uber') || 
      desc.includes('lyft') || desc.includes('taxi') || desc.includes('metro') ||
      desc.includes('bus') || desc.includes('parking') || desc.includes('toll')) {
    return 'transportation';
  }
  
  // Utilities
  if (desc.includes('electric') || desc.includes('water') || desc.includes('internet') ||
      desc.includes('phone') || desc.includes('cable') || desc.includes('utility') ||
      desc.includes('verizon') || desc.includes('at&t') || desc.includes('comcast')) {
    return 'utilities';
  }
  
  // Entertainment
  if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('movie') ||
      desc.includes('theater') || desc.includes('game') || desc.includes('entertainment') ||
      desc.includes('amazon prime') || desc.includes('hulu') || desc.includes('disney')) {
    return 'entertainment';
  }
  
  // Shopping
  if (desc.includes('amazon') || desc.includes('walmart') || desc.includes('target') ||
      desc.includes('store') || desc.includes('shop') || desc.includes('purchase') ||
      desc.includes('retail') || desc.includes('mall')) {
    return 'shopping';
  }
  
  // Healthcare
  if (desc.includes('medical') || desc.includes('doctor') || desc.includes('pharmacy') ||
      desc.includes('hospital') || desc.includes('health') || desc.includes('cvs') ||
      desc.includes('walgreens') || desc.includes('clinic')) {
    return 'healthcare';
  }
  
  // Housing
  if (desc.includes('rent') || desc.includes('mortgage') || desc.includes('property') ||
      desc.includes('home') || desc.includes('apartment') || desc.includes('housing')) {
    return 'housing';
  }
  
  // Income
  if (desc.includes('salary') || desc.includes('payroll') || desc.includes('deposit') ||
      desc.includes('income') || desc.includes('payment received') || desc.includes('refund')) {
    return 'income';
  }
  
  // Transfer
  if (desc.includes('transfer') || desc.includes('atm') || desc.includes('withdrawal') ||
      desc.includes('deposit') || desc.includes('wire')) {
    return 'transfer';
  }
  
  return 'other';
}

// Helper function to extract merchant name
function extractMerchant(description) {
  const desc = description.trim();
  
  // Common merchant patterns
  const merchantPatterns = [
    /^([A-Z\s&]+)\s+\d+/,  // MERCHANT NAME followed by numbers
    /^([A-Z][A-Za-z\s&]+?)(?:\s+\d|\s*$)/,  // Capitalized merchant name
    /([A-Z]{2,}(?:\s+[A-Z]{2,})*)/  // All caps words
  ];
  
  for (const pattern of merchantPatterns) {
    const match = desc.match(pattern);
    if (match && match[1] && match[1].length > 2) {
      return match[1].trim();
    }
  }
  
  // If no pattern matches, return first few words
  const words = desc.split(' ').slice(0, 3).join(' ');
  return words.length > 20 ? words.substring(0, 20) + '...' : words;
}

// Helper function to parse various date formats
function parseDate(dateStr) {
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY or M/D/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/ // DD-MM-YYYY
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year, month, day;
      
      if (format === formats[0]) { // YYYY-MM-DD
        [, year, month, day] = match;
      } else if (format === formats[1]) { // MM/DD/YYYY
        [, month, day, year] = match;
      } else { // DD-MM-YYYY
        [, day, month, year] = match;
      }
      
      // Validate date components
      year = parseInt(year);
      month = parseInt(month);
      day = parseInt(day);
      
      if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        continue;
      }
      
      // Return in YYYY-MM-DD format
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  
  return null;
}

module.exports = router;