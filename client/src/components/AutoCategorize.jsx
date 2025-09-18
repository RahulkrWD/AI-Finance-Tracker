import React, { useState, useEffect } from "react";
import axios from "axios";
import "../syles/AutoCategorize.css";

const AutoCategorize = ({ onClose, onCategorizeComplete }) => {
  const [uncategorizedTransactions, setUncategorizedTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState({});
  const [selectedCategories, setSelectedCategories] = useState({});

  // Smart categorization rules based on common patterns
  const categorizationRules = {
    "Food & Dining": [
      "restaurant", "cafe", "food", "dining", "pizza", "burger", "coffee",
      "starbucks", "mcdonalds", "subway", "dominos", "kfc", "taco", "sushi",
      "bakery", "deli", "bar", "pub", "brewery", "kitchen", "grill", "bistro"
    ],
    "Shopping": [
      "amazon", "walmart", "target", "costco", "mall", "store", "shop",
      "retail", "purchase", "buy", "clothing", "shoes", "electronics",
      "best buy", "home depot", "lowes", "ikea", "furniture", "appliance"
    ],
    "Transportation": [
      "gas", "fuel", "uber", "lyft", "taxi", "bus", "train", "metro",
      "parking", "toll", "car", "auto", "vehicle", "repair", "maintenance",
      "oil change", "tire", "mechanic", "insurance", "registration"
    ],
    "Utilities": [
      "electric", "electricity", "gas bill", "water", "sewer", "internet",
      "phone", "mobile", "cable", "tv", "streaming", "netflix", "spotify",
      "utility", "bill", "service", "provider", "telecom"
    ],
    "Healthcare": [
      "doctor", "hospital", "clinic", "pharmacy", "medicine", "prescription",
      "dental", "dentist", "medical", "health", "insurance", "copay",
      "therapy", "physical therapy", "vision", "optometry"
    ],
    "Entertainment": [
      "movie", "cinema", "theater", "concert", "show", "game", "gaming",
      "sports", "gym", "fitness", "club", "recreation", "hobby",
      "subscription", "streaming", "music", "book", "magazine"
    ],
    "Housing": [
      "rent", "mortgage", "property", "real estate", "home", "house",
      "apartment", "condo", "hoa", "maintenance", "repair", "cleaning",
      "lawn", "garden", "security", "alarm"
    ],
    "Education": [
      "school", "university", "college", "tuition", "books", "supplies",
      "course", "class", "training", "certification", "workshop",
      "education", "learning", "student"
    ],
    "Personal Care": [
      "salon", "barber", "haircut", "spa", "massage", "beauty", "cosmetics",
      "skincare", "personal", "hygiene", "grooming", "nail", "manicure"
    ],
    "Travel": [
      "hotel", "flight", "airline", "airport", "vacation", "trip", "travel",
      "booking", "airbnb", "rental", "cruise", "tour", "luggage", "visa"
    ]
  };

  useEffect(() => {
    fetchUncategorizedTransactions();
  }, []);

  const fetchUncategorizedTransactions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/transactions`
      );
      
      // Filter transactions that have generic categories or might need recategorization
      const needsCategorization = response.data.filter(transaction => 
        !transaction.category || 
        transaction.category === "Other" || 
        transaction.category === "Uncategorized" ||
        !transaction.userModified
      );

      setUncategorizedTransactions(needsCategorization);
      
      // Generate suggestions for each transaction
      const newSuggestions = {};
      const newSelectedCategories = {};
      
      needsCategorization.forEach(transaction => {
        const suggestion = suggestCategory(transaction.description);
        newSuggestions[transaction._id] = suggestion;
        newSelectedCategories[transaction._id] = suggestion.category;
      });
      
      setSuggestions(newSuggestions);
      setSelectedCategories(newSelectedCategories);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setError("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const suggestCategory = (description) => {
    const desc = description.toLowerCase();
    let bestMatch = { category: "Other", confidence: 0, keywords: [] };

    // Check each category's keywords
    Object.entries(categorizationRules).forEach(([category, keywords]) => {
      const matchedKeywords = keywords.filter(keyword => 
        desc.includes(keyword.toLowerCase())
      );
      
      if (matchedKeywords.length > 0) {
        const confidence = Math.min(matchedKeywords.length * 0.3 + 0.4, 1.0);
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            category,
            confidence,
            keywords: matchedKeywords
          };
        }
      }
    });

    return bestMatch;
  };

  const handleCategoryChange = (transactionId, category) => {
    setSelectedCategories(prev => ({
      ...prev,
      [transactionId]: category
    }));
  };

  const handleApplyAll = async () => {
    try {
      setProcessing(true);
      
      // Update all transactions with their selected categories
      const updatePromises = uncategorizedTransactions.map(transaction => {
        const newCategory = selectedCategories[transaction._id];
        if (newCategory && newCategory !== transaction.category) {
          return axios.put(
            `${import.meta.env.VITE_API_URL}/api/transactions/${transaction._id}`,
            {
              ...transaction,
              category: newCategory,
              userModified: true
            }
          );
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);
      
      if (onCategorizeComplete) {
        onCategorizeComplete();
      }
      
      onClose();
    } catch (error) {
      console.error("Error applying categorization:", error);
      setError("Failed to apply categorization");
    } finally {
      setProcessing(false);
    }
  };

  const handleApplySingle = async (transaction) => {
    try {
      const newCategory = selectedCategories[transaction._id];
      if (!newCategory || newCategory === transaction.category) return;

      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/transactions/${transaction._id}`,
        {
          ...transaction,
          category: newCategory,
          userModified: true
        }
      );

      // Remove from uncategorized list
      setUncategorizedTransactions(prev => 
        prev.filter(t => t._id !== transaction._id)
      );
    } catch (error) {
      console.error("Error updating transaction:", error);
      setError("Failed to update transaction");
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return "#10b981"; // Green
    if (confidence >= 0.6) return "#f59e0b"; // Yellow
    return "#ef4444"; // Red
  };

  const getConfidenceText = (confidence) => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    return "Low";
  };

  if (loading) {
    return (
      <div className="auto-categorize-modal">
        <div className="auto-categorize-content">
          <div className="loading">Loading transactions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auto-categorize-modal">
      <div className="auto-categorize-content">
        <div className="auto-categorize-header">
          <h2>Smart Categorization</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="auto-categorize-body">
          {error && <div className="error-message">{error}</div>}

          {uncategorizedTransactions.length === 0 ? (
            <div className="no-transactions">
              <p>All transactions are properly categorized!</p>
            </div>
          ) : (
            <>
              <div className="categorize-info">
                <p>
                  Found {uncategorizedTransactions.length} transactions that could benefit from better categorization.
                  Review the suggestions below and apply changes.
                </p>
              </div>

              <div className="transactions-list">
                {uncategorizedTransactions.map((transaction) => {
                  const suggestion = suggestions[transaction._id];
                  const selectedCategory = selectedCategories[transaction._id];
                  
                  return (
                    <div key={transaction._id} className="transaction-item">
                      <div className="transaction-info">
                        <div className="transaction-description">
                          {transaction.description}
                        </div>
                        <div className="transaction-details">
                          <span className="amount">
                            ${Math.abs(transaction.amount).toFixed(2)}
                          </span>
                          <span className="date">
                            {new Date(transaction.date).toLocaleDateString()}
                          </span>
                          <span className="current-category">
                            Current: {transaction.category || "None"}
                          </span>
                        </div>
                      </div>

                      <div className="categorization-section">
                        <div className="suggestion-info">
                          <div className="suggested-category">
                            Suggested: {suggestion.category}
                          </div>
                          <div 
                            className="confidence-badge"
                            style={{ backgroundColor: getConfidenceColor(suggestion.confidence) }}
                          >
                            {getConfidenceText(suggestion.confidence)} Confidence
                          </div>
                          {suggestion.keywords.length > 0 && (
                            <div className="matched-keywords">
                              Keywords: {suggestion.keywords.join(", ")}
                            </div>
                          )}
                        </div>

                        <div className="category-selection">
                          <select
                            value={selectedCategory}
                            onChange={(e) => handleCategoryChange(transaction._id, e.target.value)}
                          >
                            {Object.keys(categorizationRules).map(category => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                            <option value="Other">Other</option>
                          </select>
                          <button
                            onClick={() => handleApplySingle(transaction)}
                            className="apply-single-btn"
                            disabled={selectedCategory === transaction.category}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="auto-categorize-footer">
                <button
                  onClick={handleApplyAll}
                  className="apply-all-btn"
                  disabled={processing}
                >
                  {processing ? "Applying..." : "Apply All Changes"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoCategorize;