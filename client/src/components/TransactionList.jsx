import React, { useState, useEffect } from "react";
import axios from "axios";
import "../syles/TransactionList.css";

// Predefined categories for transactions
const CATEGORIES = [
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

const TransactionList = ({ transactions }) => {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [filters, setFilters] = useState({
    category: "",
    type: "",
    dateFrom: "",
    dateTo: "",
    searchTerm: "",
  });
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const handleEdit = (transaction) => {
    setEditingId(transaction._id);
    setEditForm({
      ...transaction,
      date: transaction.date
        ? new Date(transaction.date).toISOString().split("T")[0]
        : "",
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm({
      ...editForm,
      [name]: name === "amount" ? parseFloat(value) : value,
      userModified: true, // Mark as user modified
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const updatedTransaction = { ...editForm };

      // Format date properly if it's a string
      if (typeof updatedTransaction.date === "string") {
        updatedTransaction.date = new Date(updatedTransaction.date);
      }

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/transactions/${editingId}`,
        updatedTransaction
      );
      setEditingId(null);

      // Use the response data to ensure we have the most up-to-date version from the server
      const updatedFromServer = response.data;

      // Note: We don't modify the transactions prop directly as it's passed from parent
      // Instead, we update our filtered transactions state for the UI
      setFilteredTransactions((prevFiltered) =>
        prevFiltered.map((t) =>
          t._id === editingId ? { ...t, ...updatedFromServer } : t
        )
      );
    } catch (error) {
      console.error("Error updating transaction:", error);
      alert("Failed to update transaction. Please try again.");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      try {
        await axios.delete(
          `${import.meta.env.VITE_API_URL}/api/transactions/${id}`
        );
        // Update local state to remove the deleted transaction
        setFilteredTransactions(
          filteredTransactions.filter((t) => t._id !== id)
        );
      } catch (error) {
        console.error("Error deleting transaction:", error);
        alert("Failed to delete transaction. Please try again.");
      }
    }
  };

  // Filtering and sorting
  useEffect(() => {
    let result = [...transactions];

    // Apply filters
    if (filters.category) {
      result = result.filter((item) => item.category === filters.category);
    }

    if (filters.type) {
      result = result.filter((item) => item.type === filters.type);
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      result = result.filter((item) => new Date(item.date) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      result = result.filter((item) => new Date(item.date) <= toDate);
    }

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.description.toLowerCase().includes(searchLower) ||
          item.merchant?.toLowerCase().includes(searchLower) ||
          item.category.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      const aValue =
        sortConfig.key === "date"
          ? new Date(a[sortConfig.key])
          : a[sortConfig.key];
      const bValue =
        sortConfig.key === "date"
          ? new Date(b[sortConfig.key])
          : b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });

    setFilteredTransactions(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [transactions, filters, sortConfig]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const resetFilters = () => {
    setFilters({
      category: "",
      type: "",
      dateFrom: "",
      dateTo: "",
      searchTerm: "",
    });
  };

  // const formatDate = (dateString) => {
  //   const date = new Date(dateString);
  //   return date.toLocaleDateString();
  // };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // const getCategoryIcon = (category) => {
  //   const icons = {
  //     'food': '🍔',
  //     'groceries': '🛒',
  //     'entertainment': '🎬',
  //     'utilities': '💡',
  //     'transportation': '🚗',
  //     'housing': '🏠',
  //     'healthcare': '⚕️',
  //     'education': '📚',
  //     'shopping': '🛍️',
  //     'income': '💰',
  //     'transfer': '↔️'
  //   };
  //   return icons[category.toLowerCase()] || '📝';
  // };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTransactions.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Get pagination group to display
  // const getPaginationGroup = () => {
  //   let start = Math.floor((currentPage - 1) / 5) * 5;
  //   return new Array(Math.min(5, totalPages - start))
  //     .fill()
  //     .map((_, idx) => start + idx + 1);
  // };

  // Get unique categories for filter dropdown
  // const uniqueCategories = [...new Set(transactions.map(t => t.category))].sort();

  // Format currency function is already defined above

  // This filtering and sorting logic is already implemented above

  // handleSort and handleFilterChange functions are already defined above

  // resetFilters function is already defined above

  // Pagination is already calculated above

  if (transactions.length === 0) {
    return (
      <div className="no-transactions">
        No transactions found. Upload a bank statement to get started.
      </div>
    );
  }
  return (
    <div className="transaction-list">
      <h2>Transactions</h2>

      <div className="filters">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="searchTerm">Search:</label>
            <input
              type="text"
              id="searchTerm"
              name="searchTerm"
              value={filters.searchTerm}
              onChange={handleFilterChange}
              placeholder="Search transactions..."
            />
          </div>

          <div className="filter-group">
            <label htmlFor="category">Category:</label>
            <select
              id="category"
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="type">Type:</label>
            <select
              id="type"
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
            >
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="dateFrom">From:</label>
            <input
              type="date"
              id="dateFrom"
              name="dateFrom"
              value={filters.dateFrom}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="dateTo">To:</label>
            <input
              type="date"
              id="dateTo"
              name="dateTo"
              value={filters.dateTo}
              onChange={handleFilterChange}
            />
          </div>

          <button className="reset-filters-btn" onClick={resetFilters}>
            Reset Filters
          </button>
        </div>
      </div>

      <div className="transaction-table-container">
        <table className="transaction-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("date")} className="sortable">
                Date{" "}
                {sortConfig.key === "date" && (
                  <span className="sort-indicator">
                    {sortConfig.direction === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
              <th
                onClick={() => handleSort("description")}
                className="sortable"
              >
                Description{" "}
                {sortConfig.key === "description" && (
                  <span className="sort-indicator">
                    {sortConfig.direction === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort("category")} className="sortable">
                Category{" "}
                {sortConfig.key === "category" && (
                  <span className="sort-indicator">
                    {sortConfig.direction === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort("amount")} className="sortable">
                Amount{" "}
                {sortConfig.key === "amount" && (
                  <span className="sort-indicator">
                    {sortConfig.direction === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan="5" className="no-transactions">
                  No transactions found
                </td>
              </tr>
            ) : (
              currentItems.map((transaction) => (
                <tr key={transaction._id} className={transaction.type}>
                  {editingId === transaction._id ? (
                    // Edit mode
                    <td colSpan="5" className="edit-form-cell">
                      <form onSubmit={handleSubmit} className="edit-form">
                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor="date">Date:</label>
                            <input
                              type="date"
                              id="date"
                              name="date"
                              value={editForm.date}
                              onChange={handleChange}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="type">Type:</label>
                            <select
                              id="type"
                              name="type"
                              value={editForm.type}
                              onChange={handleChange}
                              required
                            >
                              <option value="income">Income</option>
                              <option value="expense">Expense</option>
                              <option value="transfer">Transfer</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label htmlFor="amount">Amount:</label>
                            <input
                              type="number"
                              id="amount"
                              name="amount"
                              value={editForm.amount}
                              onChange={handleChange}
                              step="0.01"
                              required
                            />
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group description-group">
                            <label htmlFor="description">Description:</label>
                            <input
                              type="text"
                              id="description"
                              name="description"
                              value={editForm.description}
                              onChange={handleChange}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor="category">Category:</label>
                            <select
                              id="category"
                              name="category"
                              value={editForm.category}
                              onChange={handleChange}
                              required
                            >
                              {CATEGORIES.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group merchant-group">
                            <label htmlFor="merchant">Merchant/Source:</label>
                            <input
                              type="text"
                              id="merchant"
                              name="merchant"
                              value={editForm.merchant}
                              onChange={handleChange}
                            />
                          </div>
                        </div>

                        <div className="form-actions">
                          <button type="submit" className="save-btn">
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={handleCancel}
                            className="cancel-btn"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    // View mode
                    <>
                      <td>{new Date(transaction.date).toLocaleDateString()}</td>
                      <td>
                        <div className="transaction-description">
                          <span className="description-text">
                            {transaction.description}
                          </span>
                          {transaction.merchant && (
                            <span className="merchant-text">
                              {transaction.merchant}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`category-badge ${transaction.category
                            .toLowerCase()
                            .replace(/[& ]/g, "-")}`}
                        >
                          {transaction.category}
                        </span>
                        {transaction.userModified && (
                          <span
                            className="user-modified-badge"
                            title="User modified"
                          >
                            ✓
                          </span>
                        )}
                      </td>
                      <td className={`amount ${transaction.type}`}>
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="actions">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="edit-btn"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(transaction._id)}
                          className="delete-btn"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {filteredTransactions.length > itemsPerPage && (
          <div className="pagination">
            <button
              onClick={() => paginate(1)}
              disabled={currentPage === 1}
              title="First Page"
            >
              &laquo;
            </button>
            <button
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
              title="Previous Page"
            >
              &lsaquo;
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show pages around current page
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => paginate(pageNum)}
                  className={currentPage === pageNum ? "active" : ""}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
              title="Next Page"
            >
              &rsaquo;
            </button>

            <button
              onClick={() => paginate(totalPages)}
              disabled={currentPage === totalPages}
              title="Last Page"
            >
              &raquo;
            </button>
          </div>
        )}

        <div className="items-per-page">
          <label htmlFor="itemsPerPage">Items per page:</label>
          <select
            id="itemsPerPage"
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span className="showing-text">
            Showing{" "}
            {filteredTransactions.length > 0
              ? (currentPage - 1) * itemsPerPage + 1
              : 0}{" "}
            to{" "}
            {Math.min(currentPage * itemsPerPage, filteredTransactions.length)}{" "}
            of {filteredTransactions.length} entries
          </span>
        </div>
      </div>
    </div>
  );
};

export default TransactionList;
