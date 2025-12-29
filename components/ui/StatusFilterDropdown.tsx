import React, { useState, useRef, useEffect } from 'react';

interface StatusFilterOption {
  value: string;
  label: string;
  emoji?: string;
}

interface StatusFilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: StatusFilterOption[];
}

export const StatusFilterDropdown: React.FC<StatusFilterDropdownProps> = ({
  value,
  onChange,
  options
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="custom-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className="dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="dropdown-label">
          {selectedOption.emoji && <span className="dropdown-emoji">{selectedOption.emoji}</span>}
          {selectedOption.label}
        </span>
        <svg
          className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`dropdown-option ${option.value === value ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.emoji && <span className="dropdown-emoji">{option.emoji}</span>}
              <span className="dropdown-option-label">{option.label}</span>
              {option.value === value && (
                <svg
                  className="check-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 9L7 13L15 5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      <style>{`
        .custom-dropdown {
          position: relative;
          flex: 1;
        }

        .dropdown-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 10px 14px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s ease;
          gap: 8px;
        }

        .dark .dropdown-trigger {
          background: #0f172a;
          border-color: #475569;
          color: #e2e8f0;
        }

        .dropdown-trigger:hover {
          border-color: #3b82f6;
          background: #f8fafc;
        }

        .dark .dropdown-trigger:hover {
          background: #1e293b;
          border-color: #60a5fa;
        }

        .dropdown-trigger:active {
          transform: scale(0.98);
        }

        .dropdown-label {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .dropdown-emoji {
          font-size: 1.1em;
        }

        .dropdown-arrow {
          transition: transform 0.2s ease;
          color: #94a3b8;
          flex-shrink: 0;
        }

        .dark .dropdown-arrow {
          color: #64748b;
        }

        .dropdown-arrow.open {
          transform: rotate(180deg);
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.05);
          z-index: 1000;
          overflow: hidden;
          animation: slideDown 0.2s ease;
        }

        .dark .dropdown-menu {
          background: #1e293b;
          border-color: #475569;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4), 0 4px 10px rgba(0, 0, 0, 0.2);
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dropdown-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 14px;
          background: transparent;
          border: none;
          font-size: 0.9rem;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .dark .dropdown-option {
          color: #e2e8f0;
        }

        .dropdown-option:hover {
          background: #f1f5f9;
        }

        .dark .dropdown-option:hover {
          background: #334155;
        }

        .dropdown-option.selected {
          background: #eff6ff;
          color: #3b82f6;
          font-weight: 600;
        }

        .dark .dropdown-option.selected {
          background: #1e3a8a;
          color: #60a5fa;
        }

        .dropdown-option-label {
          flex: 1;
        }

        .check-icon {
          color: #3b82f6;
          flex-shrink: 0;
        }

        .dark .check-icon {
          color: #60a5fa;
        }
      `}</style>
    </div>
  );
};
