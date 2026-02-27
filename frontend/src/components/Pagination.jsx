import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  hasNext, 
  hasPrev,
  loading = false 
}) => {
  const pages = [];
  const showPages = 5;
  const halfShow = Math.floor(showPages / 2);
  
  let startPage = Math.max(1, currentPage - halfShow);
  let endPage = Math.min(totalPages, startPage + showPages - 1);
  
  if (endPage - startPage + 1 < showPages) {
    startPage = Math.max(1, endPage - showPages + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 sm:px-4 py-3 sm:py-4">
      <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1 text-center sm:text-left">
        Página {currentPage} de {totalPages}
      </div>
      
      <div className="flex items-center justify-center space-x-1 sm:space-x-2 order-1 sm:order-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={!hasPrev || loading}
          className="h-8 w-8"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev || loading}
          className="h-8 w-8"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <div className="flex items-center space-x-1">
          {startPage > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(1)}
                disabled={loading}
                className="h-8 w-8"
              >
                1
              </Button>
              {startPage > 2 && <span className="px-1 text-muted-foreground">...</span>}
            </>
          )}
          
          {pages.map((page) => (
            <Button
              key={page}
              variant={page === currentPage ? "default" : "outline"}
              size="icon"
              onClick={() => onPageChange(page)}
              disabled={loading}
              className="h-8 w-8"
            >
              {page}
            </Button>
          ))}
          
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-1 text-muted-foreground">...</span>}
              <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(totalPages)}
                disabled={loading}
                className="h-8 w-8"
              >
                {totalPages}
              </Button>
            </>
          )}
        </div>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext || loading}
          className="h-8 w-8"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(totalPages)}
          disabled={!hasNext || loading}
          className="h-8 w-8"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="text-xs sm:text-sm text-muted-foreground order-3 hidden sm:block">
        {totalPages > 0 && `${totalPages} página${totalPages > 1 ? 's' : ''} en total`}
      </div>
    </div>
  );
};

export default Pagination;