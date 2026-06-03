export const PAGE_SIZE = 5;

export default function Pagination({ page, total, loading, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="pagination">
      <span className="pagination-info">
        {total === 0 ? "No rows" : `${start}-${end} of ${total}`}
      </span>
      <div className="pagination-actions">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={loading || page === 0}
        >
          Previous
        </button>
        <span className="pagination-page">Page {page + 1} / {totalPages}</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={loading || page + 1 >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
