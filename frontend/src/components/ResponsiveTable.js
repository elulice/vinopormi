import { Card, CardContent } from '@/components/ui/card';

const ResponsiveTable = ({ 
  headers, 
  rows, 
  renderDesktopRow, 
  renderMobileCard,
  useCard = true
}) => {
  return (
    <>
      {/* Desktop: Tabla normal */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map((header, index) => (
                <th 
                  key={index} 
                  className="text-left p-2 text-xs"
                  style={{ width: header.width }}
                >
                  {header.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => renderDesktopRow(row, index))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards */}
      <div className="lg:hidden space-y-4">
        {rows.map((row, index) => (
          useCard ? (
            <Card key={index} className="shadow-sm">
              <CardContent className="p-4">
                {renderMobileCard(row, index)}
              </CardContent>
            </Card>
          ) : (
            renderMobileCard(row, index)
          )
        ))}
      </div>
    </>
  );
};

export default ResponsiveTable;