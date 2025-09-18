import React, { useState, useEffect } from "react";
import axios from "axios";
import "../syles/CategoryManager.css";

const CategoryManager = ({ onClose, onCategoriesUpdated }) => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Default categories that cannot be deleted
  const defaultCategories = [
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
    "Other",
  ];

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      // Get all unique categories from transactions
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/transactions`
      );
      
      const transactionCategories = response.data.map((t) => t.category).filter(Boolean);
      
      // Combine default categories with unique transaction categories
      const allCategories = [
        ...new Set([...defaultCategories, ...transactionCategories])
      ].sort();
      
      setCategories(allCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      setError("Failed to load categories");
      // Fallback to default categories
      setCategories(defaultCategories);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    const trimmedCategory = newCategory.trim();
    
    if (!trimmedCategory) {
      setError("Category name cannot be empty");
      return;
    }

    // Check if category already exists (case-insensitive)
    const categoryExists = categories.some(
      cat => cat.toLowerCase() === trimmedCategory.toLowerCase()
    );
    
    if (categoryExists) {
      setError("Category already exists");
      return;
    }

    try {
      // Add the new category to the list
      const updatedCategories = [...categories, trimmedCategory].sort();
      setCategories(updatedCategories);
      setNewCategory("");
      setError("");
      
      // Notify parent component
      if (onCategoriesUpdated) {
        onCategoriesUpdated(updatedCategories);
      }
    } catch (error) {
      console.error("Error adding category:", error);
      setError("Failed to add category");
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setEditValue(category);
  };

  const handleSaveEdit = async () => {
    const trimmedValue = editValue.trim();
    
    if (!trimmedValue) {
      setError("Category name cannot be empty");
      return;
    }

    if (trimmedValue === editingCategory) {
      setEditingCategory(null);
      return;
    }

    // Check if category already exists (case-insensitive, excluding current category)
    const categoryExists = categories.some(
      cat => cat.toLowerCase() === trimmedValue.toLowerCase() && cat !== editingCategory
    );
    
    if (categoryExists) {
      setError("Category already exists");
      return;
    }

    try {
      // Update all transactions with the old category to use the new category
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/transactions/bulk-update-category`,
        {
          oldCategory: editingCategory,
          newCategory: trimmedValue,
        }
      );

      // Update local categories list
      const updatedCategories = categories
        .map((cat) => (cat === editingCategory ? trimmedValue : cat))
        .sort();
      
      setCategories(updatedCategories);
      setEditingCategory(null);
      setEditValue("");
      setError("");

      // Notify parent component
      if (onCategoriesUpdated) {
        onCategoriesUpdated(updatedCategories);
      }
    } catch (error) {
      console.error("Error updating category:", error);
      setError("Failed to update category");
    }
  };

  const handleDeleteCategory = async (category) => {
    if (defaultCategories.includes(category)) {
      setError("Cannot delete default categories");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete "${category}"? All transactions with this category will be moved to "Other".`
      )
    ) {
      return;
    }

    try {
      // Update all transactions with this category to "Other"
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/transactions/bulk-update-category`,
        {
          oldCategory: category,
          newCategory: "Other",
        }
      );

      // Remove from local categories list
      const updatedCategories = categories.filter((cat) => cat !== category);
      setCategories(updatedCategories);
      setError("");

      // Notify parent component
      if (onCategoriesUpdated) {
        onCategoriesUpdated(updatedCategories);
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      setError("Failed to delete category");
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditValue("");
    setError("");
  };

  if (loading) {
    return (
      <div className="category-manager-modal">
        <div className="category-manager-content">
          <div className="loading">Loading categories...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="category-manager-modal">
      <div className="category-manager-content">
        <div className="category-manager-header">
          <h2>Manage Categories</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="category-manager-body">
          {error && <div className="error-message">{error}</div>}

          {/* Add new category */}
          <div className="add-category-section">
            <h3>Add New Category</h3>
            <div className="add-category-form">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter category name"
                onKeyPress={(e) => e.key === "Enter" && handleAddCategory()}
              />
              <button onClick={handleAddCategory} className="add-btn">
                Add
              </button>
            </div>
          </div>

          {/* Categories list */}
          <div className="categories-section">
            <h3>Existing Categories ({categories.length})</h3>
            <div className="categories-list">
              {categories.map((category) => (
                <div key={category} className="category-item">
                  {editingCategory === category ? (
                    <div className="category-edit">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSaveEdit()}
                        autoFocus
                      />
                      <div className="edit-actions">
                        <button onClick={handleSaveEdit} className="save-btn">
                          ✓
                        </button>
                        <button onClick={handleCancelEdit} className="cancel-btn">
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="category-display">
                      <span className="category-name">{category}</span>
                      <div className="category-actions">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="edit-btn"
                          title="Edit category"
                        >
                          ✏️
                        </button>
                        {!defaultCategories.includes(category) && (
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            className="delete-btn"
                            title="Delete category"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="category-manager-footer">
            <p className="note">
              <strong>Note:</strong> Default categories cannot be deleted. Custom
              categories can be edited or deleted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;