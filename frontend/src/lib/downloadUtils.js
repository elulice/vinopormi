import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { toast } from 'sonner';

export const downloadVentaAsImage = async (contentRef, ventaId) => {
  if (!contentRef) return;
  try {
    const canvas = await html2canvas(contentRef, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    });
    const link = document.createElement('a');
    link.download = `venta-${ventaId}-${format(new Date(), 'yyyyMMdd-HHmmss')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Imagen descargada correctamente');
    return true;
  } catch (error) {
    toast.error('Error al descargar la imagen');
    return false;
  }
};

export const downloadVentaAsPDF = async (contentRef, ventaId) => {
  if (!contentRef) return;
  try {
    const canvas = await html2canvas(contentRef, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`venta-${ventaId}-${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`);
    toast.success('PDF descargado correctamente');
    return true;
  } catch (error) {
    toast.error('Error al descargar el PDF');
    return false;
  }
};
