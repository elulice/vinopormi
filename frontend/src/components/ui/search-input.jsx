import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from './input';

export const SearchInput = forwardRef(function SearchInput({ value, onChange, onClear, placeholder = "Buscar..." }, ref) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
      <Input
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10 w-full"
      />
      {value && (
        <X 
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer z-10"
          onClick={onClear}
        />
      )}
    </div>
  );
});
