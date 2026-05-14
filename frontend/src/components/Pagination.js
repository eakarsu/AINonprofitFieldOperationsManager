import React from 'react';

export default function Pagination({ page, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn btn-secondary btn-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        &laquo; Prev
      </button>
      <span>Page {page} of {totalPages}</span>
      <button className="btn btn-secondary btn-sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Next &raquo;
      </button>
    </div>
  );
}
