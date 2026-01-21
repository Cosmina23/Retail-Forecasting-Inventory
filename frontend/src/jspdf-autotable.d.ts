declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';

  interface AutoTableOptions {
    startY?: number;
    head?: any[][];
    body?: any[][];
    theme?: 'striped' | 'grid' | 'plain';
    headStyles?: any;
    styles?: any;
    columnStyles?: any;
    margin?: any;
    didDrawPage?: (data: any) => void;
    didDrawCell?: (data: any) => void;
  }

  function autoTable(doc: jsPDF, options: AutoTableOptions): void;
  
  export default autoTable;
}
