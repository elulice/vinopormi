import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

const SearchInput = forwardRef(({
  value,
  onChange,
  onClear,
  onSearch,
  placeholder = 'Buscar...',
  className = '',
  inputClassName = '',
}, ref) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
      <Input
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`pl-7 pr-7 h-7 text-sm w-40 ${inputClassName}`}
      />
      {value && (
        <X 
          className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={onClear}
        />
      )}
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
