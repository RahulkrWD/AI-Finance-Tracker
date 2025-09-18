import React, { useState, useEffect } from "react";
import axios from "axios";
import "../syles/AddTransaction.css";

// Predefined categories for transactions
// Default categories as fallback
const DEFAULT_CATEGORIES = [
  "Food & Dining",
  "Shopping", 
  "Housing",
  "Transportation",
  "Entertainment",
  "Healthcare",
  "Education",
  "Personal Care",
  "Travel",
  "Utilities",
  "Insurance",
  "Investments",
  "Income",
  "Transfer",
  "Other"
];

const AddTransaction = ({ onTransactionAdded, onClose }) => {
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    type: "expense",
    category: "Other",
    merchant: "",
    date: new Date().toISOString().split("T")[0], // Today's date
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  // Fetch categories from existing transactions
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/transactions`
        );
        
        const uniqueCategories = [
          ...new Set(response.data.map((t) => t.category))
        ].sort();
        
        if (uniqueCategories.length > 0) {
          setCategories(uniqueCategories);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
        // Keep default categories on error
      }
    };

    fetchCategories();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) || "" : value,
    }));
    setError(""); // Clear error when user starts typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    // Validation
    if (!formData.description.trim()) {
      setError("Description is required");
      setIsSubmitting(false);
      return;
    }

    if (!formData.amount || formData.amount <= 0) {
      setError("Amount must be greater than 0");
      setIsSubmitting(false);
      return;
    }

    try {
      const transactionData = {
        ...formData,
        amount: parseFloat(formData.amount),
        userModified: true, // Mark as manually added
        aiConfidence: 1.0, // Manual entry has 100% confidence
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/transactions`,
        transactionData
      );

      // Reset form
      setFormData({
        description: "",
        amount: "",
        type: "expense",
        category: "Other",
        merchant: "",
        date: new Date().toISOString().split("T")[0],
      });

      // Notify parent component
      if (onTransactionAdded) {
        onTransactionAdded(response.data);
      }

      // Close modal/form
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Error adding transaction:", error);
      setError(
        error.response?.data?.message ||
          "Failed to add transaction. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      description: "",
      amount: "",
      type: "expense",
      category: "Other",
      merchant: "",
      date: new Date().toISOString().split("T")[0],
    });
    setError("");
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="add-transaction-modal">
      <div className="add-transaction-content">
        <div className="add-transaction-header">
          <h2>Add New Transaction</h2>
          <button className="close-btn" onClick={handleCancel}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-transaction-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="description">Description *</label>
              <input
                type="text"
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter transaction description"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="amount">Amount *</label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="type">Type</label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="merchant">Merchant</label>
              <input
                type="text"
                id="merchant"
                name="merchant"
                value={formData.merchant}
                onChange={handleChange}
                placeholder="Enter merchant name (optional)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="date">Date</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTransaction;