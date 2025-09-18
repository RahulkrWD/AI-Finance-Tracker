const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

// Get all transactions
router.get('/', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 }).exec();
    res.json(transactions || []);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get transaction by ID
router.get('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).exec();
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new transaction
router.post('/', async (req, res) => {
  try {
    const newTransaction = new Transaction(req.body);
    const savedTransaction = await newTransaction.save();
    res.status(201).json(savedTransaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update transaction
router.put('/:id', async (req, res) => {
  try {
    // Mark as user modified
    req.body.userModified = true;
    
    const updatedTransaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).exec();
    
    if (!updatedTransaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.json(updatedTransaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const deletedTransaction = await Transaction.findByIdAndDelete(req.params.id).exec();
    
    if (!deletedTransaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get transactions by category
router.get('/category/:category', async (req, res) => {
  try {
    const transactions = await Transaction.find({ 
      category: req.params.category 
    }).sort({ date: -1 });
    
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions by category:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get transactions by date range
router.get('/date-range/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }
    
    const transactions = await Transaction.find({ 
      date: { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      } 
    }).sort({ date: -1 }).exec();
    
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions by date range:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get monthly spending data
router.get('/monthly-spending/:months?', async (req, res) => {
  try {
    // Default to 6 months if not specified
    const monthsToShow = parseInt(req.params.months) || 6;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsToShow + 1);
    startDate.setDate(1); // Start from the 1st of the month
    
    // Get all transactions in the date range
    const transactions = await Transaction.find({
      date: { $gte: startDate, $lte: endDate },
      type: 'expense'
    }).exec();
    
    // Initialize monthly spending data
    const monthlySpending = {};
    for (let i = 0; i < monthsToShow; i++) {
      const month = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
      const monthKey = month.toLocaleString('default', { month: 'short' }) + ' ' + month.getFullYear();
      monthlySpending[monthKey] = 0;
    }
    
    // Calculate spending for each month
    transactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const monthKey = transactionDate.toLocaleString('default', { month: 'short' }) + ' ' + transactionDate.getFullYear();
      
      if (monthlySpending.hasOwnProperty(monthKey)) {
        monthlySpending[monthKey] += transaction.amount;
      }
    });
    
    // Convert to array and sort by date
    const result = Object.entries(monthlySpending)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => {
        const [aMonth, aYear] = a.month.split(' ');
        const [bMonth, bYear] = b.month.split(' ');
        return new Date(`${aMonth} 1, ${aYear}`) - new Date(`${bMonth} 1, ${bYear}`);
      });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching monthly spending:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk update category
router.put('/bulk-update-category', async (req, res) => {
  try {
    const { oldCategory, newCategory } = req.body;
    
    if (!oldCategory || !newCategory) {
      return res.status(400).json({ 
        message: 'Both oldCategory and newCategory are required' 
      });
    }

    // Update all transactions with the old category to the new category
    const result = await Transaction.updateMany(
      { category: oldCategory },
      { 
        $set: { 
          category: newCategory,
          userModified: true 
        } 
      }
    );

    res.json({
      message: `Updated ${result.modifiedCount} transactions from "${oldCategory}" to "${newCategory}"`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk updating category:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;