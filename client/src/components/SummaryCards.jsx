import React from "react";
import "../syles/SummaryCards.css";

const SummaryCards = ({ summary }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="summary-cards">
      <div className="summary-card income">
        <h3>Total Income</h3>
        <p className="amount">{formatCurrency(summary.totalIncome)}</p>
        <i className="card-icon income-icon">💰</i>
      </div>

      <div className="summary-card expenses">
        <h3>Total Expenses</h3>
        <p className="amount">{formatCurrency(summary.totalExpenses)}</p>
        <i className="card-icon expense-icon">💸</i>
      </div>

      <div className="summary-card balance">
        <h3>Net Balance</h3>
        <p
          className={`amount ${
            summary.netBalance >= 0 ? "positive" : "negative"
          }`}
        >
          {formatCurrency(summary.netBalance)}
        </p>
        <i className="card-icon balance-icon">
          {summary.netBalance >= 0 ? "✅" : "⚠️"}
        </i>
      </div>
    </div>
  );
};

export default SummaryCards;
