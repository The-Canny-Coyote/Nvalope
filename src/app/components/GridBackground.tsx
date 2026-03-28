export function GridBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        className="opacity-30"
      >
        <defs>
          <pattern
            id="spreadsheet-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            {/* Vertical lines */}
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="40"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-primary dark:text-primary/20"
            />
            {/* Horizontal lines */}
            <line
              x1="0"
              y1="0"
              x2="40"
              y2="0"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-primary dark:text-primary/20"
            />
            {/* Slightly thicker lines every 5th cell (like spreadsheet) */}
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="40"
              stroke="currentColor"
              strokeWidth="1"
              className="text-primary/80 dark:text-primary/30"
              style={{ transform: 'translateX(0px)' }}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#spreadsheet-grid)" />
      </svg>
    </div>
  );
}
