import React, { useState, useEffect } from "react";
import axios from "axios";
import { Bar, Pie, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import TransactionList from "./TransactionList.jsx";
import SummaryCards from "./SummaryCards.jsx";
import AddTransaction from "./AddTransaction.jsx";
import CategoryManager from "./CategoryManager.jsx";
import AutoCategorize from "./AutoCategorize.jsx";
import "../syles/Dashboard.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monthlySpending, setMonthlySpending] = useState([]);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    categories: {},
  });
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAutoCategorize, setShowAutoCategorize] = useState(false);

  // Handler for when a new transaction is added
  const handleTransactionAdded = (newTransaction) => {
    // Add the new transaction to the list
    setTransactions(prev => [newTransaction, ...prev]);
    // Close the modal
    setShowAddTransaction(false);
    // The useEffect will automatically recalculate summary and monthly data
  };

  // Function to fetch transactions
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const transactionsResponse = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/transactions`
      );
      setTransactions(transactionsResponse.data);
      calculateSummary(transactionsResponse.data);
      generateMonthlySpendingData(transactionsResponse.data);

      setLoading(false);
    } catch (err) {
      console.error("Error fetching transaction data:", err);
      setError("Failed to fetch data. Please try again later.");
      setLoading(false);
    }
  };

  // Handler for when categories are updated
  const handleCategoriesUpdated = () => {
    // Refresh transactions to reflect category changes
    fetchTransactions();
    setShowCategoryManager(false);
  };

  // Handler for when auto-categorization is completed
  const handleCategorizeComplete = () => {
    // Refresh transactions to reflect categorization changes
    fetchTransactions();
    setShowAutoCategorize(false);
  };

  // Calculate financial summary from transactions
  const calculateSummary = (transactions) => {
    let income = 0;
    let expenses = 0;
    const categories = {};

    transactions.forEach((transaction) => {
      if (transaction.type === "income") {
        income += transaction.amount;
      } else if (transaction.type === "expense") {
        expenses += transaction.amount;

        // Categorize expenses
        if (categories[transaction.category]) {
          categories[transaction.category] += transaction.amount;
        } else {
          categories[transaction.category] = transaction.amount;
        }
      }
    });

    setSummary({
      totalIncome: income,
      totalExpenses: expenses,
      netBalance: income - expenses,
      categories,
    });
  };

  // Generate monthly spending data from transactions
  const generateMonthlySpendingData = (transactions) => {
    const monthlyData = {};
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Initialize with last 6 months
    for (let i = 0; i < 6; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = month.toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
      monthlyData[monthKey] = { income: 0, expenses: 0 };
    }

    // Populate with transaction data
    transactions.forEach((transaction) => {
      const txDate = new Date(transaction.date);
      if (txDate >= sixMonthsAgo) {
        const monthKey = txDate.toLocaleString("default", {
          month: "short",
          year: "2-digit",
        });
        if (monthlyData[monthKey]) {
          if (transaction.type === "income") {
            monthlyData[monthKey].income += transaction.amount;
          } else if (transaction.type === "expense") {
            monthlyData[monthKey].expenses += transaction.amount;
          }
        }
      }
    });

    // Convert to array format for ChartJS
    const chartData = Object.entries(monthlyData)
      .reverse()
      .map(([month, data]) => ({
        month,
        income: data.income,
        expenses: data.expenses,
      }));

    setMonthlySpending(chartData);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // This function is already defined above, so removing the duplicate

  // This chart data is not used as we have prepareCategoryChartData function

  // Prepare chart data for category breakdown
  const prepareCategoryChartData = () => {
    const categories = summary.categories;
    const labels = Object.keys(categories);
    const data = Object.values(categories);
    const backgroundColors = [
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
      "#4BC0C0",
      "#9966FF",
      "#FF9F40",
      "#8AC249",
      "#EA5F89",
      "#00D8B6",
      "#FFB7B2",
      "#95B8D1",
      "#B8E0D2",
    ];

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: backgroundColors.slice(0, labels.length),
          borderWidth: 1,
        },
      ],
    };
  };

  // Prepare chart data for monthly income/expenses
  const prepareMonthlyChartData = () => {
    return {
      labels: monthlySpending.map((item) => item.month),
      datasets: [
        {
          label: "Income",
          data: monthlySpending.map((item) => item.income),
          backgroundColor: "rgba(75, 192, 192, 0.6)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 1,
        },
        {
          label: "Expenses",
          data: monthlySpending.map((item) => item.expenses),
          backgroundColor: "rgba(255, 99, 132, 0.6)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
        },
      ],
    };
  };

  // Chart options
  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Monthly Income & Expenses",
      },
    },
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "right",
      },
      title: {
        display: true,
        text: "Expense Categories",
      },
    },
  };

  if (loading)
    return <div className="loading">Loading your financial data...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
          <h1>Financial Dashboard</h1>
          <div className="header-buttons">
            <button 
              className="smart-categorize-btn"
              onClick={() => setShowAutoCategorize(true)}
            >
              Smart Categorize
            </button>
            <button 
              className="manage-categories-btn"
              onClick={() => setShowCategoryManager(true)}
            >
              Manage Categories
            </button>
            <button 
              className="add-transaction-btn"
              onClick={() => setShowAddTransaction(true)}
            >
              Add Transaction
            </button>
          </div>
        </div>

      <SummaryCards summary={summary} />

      <div className="charts-container">
        <div className="chart-card">
          <h2>Monthly Overview</h2>
          <div className="chart-wrapper">
            <Bar data={prepareMonthlyChartData()} options={barOptions} />
          </div>
        </div>

        <div className="chart-card">
          <h2>Expense Breakdown</h2>
          <div className="chart-wrapper">
            <Doughnut data={prepareCategoryChartData()} options={pieOptions} />
          </div>
        </div>
      </div>

      <TransactionList transactions={transactions} />

      {showAddTransaction && (
          <AddTransaction
            onTransactionAdded={handleTransactionAdded}
            onClose={() => setShowAddTransaction(false)}
          />
        )}

        {showCategoryManager && (
          <CategoryManager
            onCategoriesUpdated={handleCategoriesUpdated}
            onClose={() => setShowCategoryManager(false)}
          />
        )}

        {showAutoCategorize && (
          <AutoCategorize
            onCategorizeComplete={handleCategorizeComplete}
            onClose={() => setShowAutoCategorize(false)}
          />
        )}
    </div>
  );
};

export default Dashboard;
