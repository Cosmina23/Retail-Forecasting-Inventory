import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Save, Plus, Edit, RotateCw, Download, Upload, Image, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Types
interface StoreItem {
  id: string;
  type: 'door' | 'fridge' | 'shelf' | 'cashier';
  name: string;
  x: number;
  y: number;
  rotation: number;
  shelves?: ShelfData[];
}

interface ShelfData {
  shelfNumber: number;
  productName: string;
  quantity: number;
}

interface Product {
  id: number;
  name: string;
}

const StorePlanogram: React.FC = () => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedType, setDraggedType] = useState<StoreItem['type'] | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [editingShelves, setEditingShelves] = useState<ShelfData[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [itemCounters, setItemCounters] = useState({
    door: 0,
    fridge: 0,
    shelf: 0,
    cashier: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Fetch products
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/products/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  // Grid size
  const GRID_SIZE = 40;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  // Snap to grid
  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  // Start dragging from toolbar
  const handleToolbarDragStart = (type: StoreItem['type']) => {
    setDraggedType(type);
    setIsDragging(true);
  };

  // Handle drop on canvas
  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedType || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = snapToGrid(e.clientX - rect.left - GRID_SIZE / 2);
    const y = snapToGrid(e.clientY - rect.top - GRID_SIZE / 2);

    // Generate name based on type and counter
    const newCounter = itemCounters[draggedType] + 1;
    const typeName = draggedType.charAt(0).toUpperCase() + draggedType.slice(1);
    const itemName = `${typeName}${newCounter}`;

    const newItem: StoreItem = {
      id: `${draggedType}-${Date.now()}`,
      type: draggedType,
      name: itemName,
      x,
      y,
      rotation: 0,
      shelves: draggedType === 'shelf' || draggedType === 'fridge' ? [] : undefined,
    };

    setStoreItems([...storeItems, newItem]);
    setItemCounters({ ...itemCounters, [draggedType]: newCounter });
    setIsDragging(false);
    setDraggedType(null);

    toast({
      title: 'Element Added',
      description: `${itemName} has been added to the planogram.`,
    });
  };

  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Item movement
  const handleItemDragStart = (e: React.MouseEvent, item: StoreItem) => {
    e.stopPropagation();
    setSelectedItem(item);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!selectedItem || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = snapToGrid(e.clientX - rect.left - dragOffset.x);
    const y = snapToGrid(e.clientY - rect.top - dragOffset.y);

    setStoreItems(
      storeItems.map((item) =>
        item.id === selectedItem.id ? { ...item, x, y } : item
      )
    );
  };

  const handleCanvasMouseUp = () => {
    setSelectedItem(null);
  };

  // Delete item
  const deleteItem = (id: string) => {
    setStoreItems(storeItems.filter((item) => item.id !== id));
    toast({
      title: 'Element Deleted',
      description: 'The element has been removed from planogram.',
    });
  };

  // Rotate item
  const rotateItem = (id: string) => {
    setStoreItems(
      storeItems.map((item) =>
        item.id === id ? { ...item, rotation: (item.rotation + 90) % 360 } : item
      )
    );
  };

  // Open product dialog
  const openProductDialog = (item: StoreItem) => {
    console.log('🔷 Opening dialog for:', item.name, item.id);
    if (item.type === 'shelf' || item.type === 'fridge') {
      setSelectedItem(item);
      setSelectedItemId(item.id);
      setEditingShelves(item.shelves || []);
      setShowProductDialog(true);
      console.log('✅ Dialog opened with item:', item.name);
    }
  };

  // Save shelf data - SIMPLIFICAT
  const saveShelves = async () => {
    console.log('🔵 SAVE CLICKED');
    console.log('Selected ID:', selectedItemId);
    console.log('Shelves to save:', editingShelves);
    
    setIsSaving(true);
    
    try {

      // Update store items with new shelf data
      const updatedItems = storeItems.map((item) =>
        item.id === selectedItemId ? { ...item, shelves: [...editingShelves] } : item
      );

      console.log('✅ Updated items:', updatedItems);
      
      // Update state
      setStoreItems(updatedItems);

      // Save to localStorage
      localStorage.setItem('storePlanogram', JSON.stringify(updatedItems));
      localStorage.setItem('itemCounters', JSON.stringify(itemCounters));
      console.log('✅ Saved to localStorage');

      // Save to backend
      const token = localStorage.getItem('token');
      const payload = {
        storeItems: updatedItems,
        itemCounters,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch('http://localhost:8000/api/planogram/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Backend save OK:', result.text_file);
        const itemName = storeItems.find(i => i.id === selectedItemId)?.name || 'Element';
        toast({
          title: '✅ Salvat!',
          description: `Produsele pentru ${itemName} au fost salvate`,
        });
      } else {
        console.error('❌ Backend error:', result);
      }
      
      // Close dialog
      setShowProductDialog(false);
      setIsSaving(false);
      console.log('✅ Done');
      
    } catch (error) {
      console.error('❌ Save failed:', error);
      setIsSaving(false);
      toast({
        title: 'Eroare',
        description: 'Nu s-a putut salva',
        variant: 'destructive',
      });
    }
  };

  // Add shelf row
  const addShelfRow = () => {
    const newShelfNumber = editingShelves.length + 1;
    setEditingShelves([
      ...editingShelves,
      { shelfNumber: newShelfNumber, productName: '', quantity: 0 },
    ]);
  };

  // Update shelf row
  const updateShelfRow = (
    index: number,
    field: keyof ShelfData,
    value: string | number
  ) => {
    const updated = [...editingShelves];
    updated[index] = { ...updated[index], [field]: value };
    setEditingShelves(updated);
  };

  // Delete shelf row
  const deleteShelfRow = (index: number) => {
    setEditingShelves(editingShelves.filter((_, i) => i !== index));
  };

  // Get item name
  const getItemName = (type: string) => {
    const names = {
      door: 'Door',
      fridge: 'Fridge',
      shelf: 'Shelf',
      cashier: 'Cashier',
    };
    return names[type as keyof typeof names] || type;
  };

  // Export planogram as image
  const exportAsImage = async () => {
    if (!canvasRef.current) return;

    try {
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#f9fafb',
        scale: 2,
      });

      const link = document.createElement('a');
      link.download = `store-planogram-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({
        title: 'Image Exported',
        description: 'Store layout has been saved as an image.',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export image.',
        variant: 'destructive',
      });
    }
  };

  // Export planogram as PDF with tables
  const exportAsPDF = async () => {
    try {
      await generatePDFReport();
      toast({
        title: 'PDF Exported',
        description: 'Store planogram with product tables has been saved.',
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export PDF.',
        variant: 'destructive',
      });
    }
  };

  // Save planogram and generate PDF
  const savePlanogram = async () => {
    console.log('=== SAVE PLANOGRAM CLICKED ===');
    console.log('Current storeItems:', storeItems);
    console.log('storeItems length:', storeItems.length);
    
    const itemsWithProducts = storeItems.filter(
      (item) =>
        (item.type === 'fridge' || item.type === 'shelf') &&
        item.shelves &&
        item.shelves.length > 0
    );
    console.log('Items with products:', itemsWithProducts.length);
    console.log('Full items with products:', itemsWithProducts);

    try {
      // Save to localStorage and backend
      localStorage.setItem('storePlanogram', JSON.stringify(storeItems));
      localStorage.setItem('itemCounters', JSON.stringify(itemCounters));
      console.log('✅ Saved to localStorage');

      const token = localStorage.getItem('token');
      console.log('Token exists:', !!token);

      const response = await fetch('http://localhost:8000/api/planogram/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeItems,
          itemCounters,
          timestamp: new Date().toISOString(),
        }),
      });

      const result = await response.json();
      console.log('Backend save response:', result);

      if (!response.ok) {
        console.error('Backend error:', result);
      }

      // Generate PDF automatically
      console.log('Generating PDF...');
      await generatePDFReport();

      toast({
        title: 'Planogram Saved',
        description: 'Store planogram and PDF report have been saved successfully.',
      });
    } catch (error) {
      console.error('❌ Save error:', error);
      toast({
        title: 'Save Failed',
        description: `Failed to save planogram: ${error}`,
        variant: 'destructive',
      });
    }
  };

  // Generate PDF Report
  const generatePDFReport = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Title
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Store Planogram Report', pageWidth / 2, 20, { align: 'center' });

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, {
        align: 'center',
      });

      let yPosition = 40;

      // Filter items with shelves (fridges and shelves)
      const itemsWithProducts = storeItems.filter(
        (item) =>
          (item.type === 'fridge' || item.type === 'shelf') &&
          item.shelves &&
          item.shelves.length > 0
      );

      console.log('Items with products:', itemsWithProducts.length);
      console.log('Store items:', storeItems);

      if (itemsWithProducts.length === 0) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'italic');
        pdf.text('No products assigned to any shelves or fridges yet.', pageWidth / 2, yPosition, {
          align: 'center',
        });
        pdf.text('Please add products to your shelves/fridges and save again.', pageWidth / 2, yPosition + 10, {
          align: 'center',
        });
      } else {
        // Create tables for each item
        itemsWithProducts.forEach((item, index) => {
          // Check if we need a new page
          if (yPosition > pageHeight - 70) {
            pdf.addPage();
            yPosition = 20;
          }

          // Item header
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          const icon = item.type === 'fridge' ? '❄️' : '📦';
          pdf.text(`${icon} ${item.name}`, 20, yPosition);

          yPosition += 2;

          // Subtitle with position info
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100);
          pdf.text(`Position: X=${Math.round(item.x)}, Y=${Math.round(item.y)} | Rotation: ${item.rotation}°`, 20, yPosition);
          pdf.setTextColor(0);

          yPosition += 6;

          // Create table data
          const tableData = item.shelves!.map((shelf) => [
            `Shelf ${shelf.shelfNumber}`,
            shelf.productName || 'Not assigned',
            shelf.quantity.toString(),
          ]);

          (pdf as any).autoTable({
            startY: yPosition,
            head: [['Shelf Number', 'Product Name', 'Quantity']],
            body: tableData,
            theme: 'striped',
            headStyles: {
              fillColor: item.type === 'fridge' ? [59, 130, 246] : [34, 197, 94],
              fontSize: 11,
              fontStyle: 'bold',
              textColor: [255, 255, 255],
            },
            bodyStyles: {
              fontSize: 10,
            },
            alternateRowStyles: {
              fillColor: [245, 245, 245],
            },
            columnStyles: {
              0: { cellWidth: 40, fontStyle: 'bold' },
              1: { cellWidth: 90 },
              2: { cellWidth: 30, halign: 'center' },
            },
            margin: { left: 20, right: 20 },
          });

          yPosition = (pdf as any).lastAutoTable.finalY + 15;
        });

        // Summary section
        if (yPosition > pageHeight - 80) {
          pdf.addPage();
          yPosition = 20;
        }

        yPosition += 10;

        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Summary', 20, yPosition);
        yPosition += 10;

        const summaryData = [
          ['Total Doors', storeItems.filter((i) => i.type === 'door').length.toString()],
          ['Total Fridges', storeItems.filter((i) => i.type === 'fridge').length.toString()],
          ['Total Shelves', storeItems.filter((i) => i.type === 'shelf').length.toString()],
          ['Total Cashiers', storeItems.filter((i) => i.type === 'cashier').length.toString()],
          ['Items with Products', itemsWithProducts.length.toString()],
        ];

        (pdf as any).autoTable({
          startY: yPosition,
          body: summaryData,
          theme: 'plain',
          styles: {
            fontSize: 11,
            cellPadding: 4,
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 70 },
            1: { halign: 'right', fontStyle: 'bold', textColor: [59, 130, 246] },
          },
          margin: { left: 20 },
        });
      }

      pdf.save(`store-planogram-${new Date().toISOString().split('T')[0]}.pdf`);
      return true;
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  };

  // Load planogram
  const loadPlanogram = async () => {
    try {
      // Try to load from backend first
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/planogram/load', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setStoreItems(result.data.storeItems);
          setItemCounters(result.data.itemCounters);
          toast({
            title: 'Planogram Loaded',
            description: 'Store planogram has been loaded from database.',
          });
          return;
        }
      }
    } catch (error) {
      console.log('Backend not available, loading from localStorage');
    }

    // Fallback to localStorage
    const saved = localStorage.getItem('storePlanogram');
    const savedCounters = localStorage.getItem('itemCounters');
    if (saved) {
      setStoreItems(JSON.parse(saved));
      if (savedCounters) {
        setItemCounters(JSON.parse(savedCounters));
      }
      toast({
        title: 'Planogram Loaded',
        description: 'Store planogram has been loaded from local storage.',
      });
    }
  };

  // Export planogram as JSON
  const exportPlanogram = () => {
    const dataStr = JSON.stringify(storeItems, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `planogram-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Planogram Exported',
      description: 'File has been downloaded successfully.',
    });
  };

  // Import planogram from JSON
  const importPlanogram = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setStoreItems(data);
        localStorage.setItem('storePlanogram', JSON.stringify(data));
        toast({
          title: 'Planogram Imported',
          description: 'Planogram has been loaded successfully.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Invalid file format.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Clear planogram
  const clearPlanogram = () => {
    if (confirm('Are you sure you want to clear the entire planogram?')) {
      setStoreItems([]);
      setItemCounters({ door: 0, fridge: 0, shelf: 0, cashier: 0 });
      toast({
        title: 'Planogram Cleared',
        description: 'All elements have been removed.',
      });
    }
  };

  useEffect(() => {
    loadPlanogram();
  }, []);

  return (
    <DashboardLayout>
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          📍 Planogramă Magazin
        </h1>
        <p className="text-gray-600">
          Creează aspectul magazinului tău. Trage elemente pe canvas și organizează produsele pe rafturi.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Toolbar */}
        <Card className="w-64 p-4 h-fit">
          <h2 className="text-lg font-semibold mb-4">🛠️ Elemente</h2>
          <div className="space-y-3">
            {[
              { type: 'door' as const, icon: '🚪', label: 'Ușă', color: 'bg-amber-100' },
              {
                type: 'fridge' as const,
                icon: '❄️',
                label: 'Frigider',
                color: 'bg-blue-100',
              },
              {
                type: 'shelf' as const,
                icon: '📦',
                label: 'Raft',
                color: 'bg-green-100',
              },
              {
                type: 'cashier' as const,
                icon: '💰',
                label: 'Casă',
                color: 'bg-purple-100',
              },
            ].map((item) => (
              <div
                key={item.type}
                draggable
                onDragStart={() => handleToolbarDragStart(item.type)}
                className={`${item.color} border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-move hover:shadow-lg transition-all text-center`}
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="font-medium">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            <Button 
              onClick={savePlanogram}
              className="w-full" 
              variant="default"
            >
              <Save className="w-4 h-4 mr-2" />
              Salvează Planograma
            </Button>
            <Button onClick={exportAsImage} className="w-full" variant="outline">
              <Image className="w-4 h-4 mr-2" />
              Exportă ca Imagine
            </Button>
            <Button onClick={exportAsPDF} className="w-full" variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Exportă ca PDF
            </Button>
            <Button onClick={exportPlanogram} className="w-full" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportă JSON
            </Button>
            <label htmlFor="import-file" className="block">
              <Button type="button" className="w-full" variant="outline" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Importă JSON
                </span>
              </Button>
              <input
                id="import-file"
                type="file"
                accept=".json"
                onChange={importPlanogram}
                className="hidden"
              />
            </label>
            <Button onClick={clearPlanogram} className="w-full" variant="outline">
              <Trash2 className="w-4 h-4 mr-2" />
              Șterge Tot
            </Button>
          </div>
        </Card>

        {/* Canvas */}
        <Card className="flex-1">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">🏪 Canvas Magazin</h2>
            <p className="text-sm text-gray-600">
              Trage elemente din stânga pentru a le plasa în magazin. Clic pe rafturi/frigidere pentru a adăuga produse.
            </p>
          </div>
          <div
            ref={canvasRef}
            className="relative bg-gradient-to-br from-gray-50 to-gray-100 m-4 rounded-lg overflow-hidden"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              backgroundImage: `
                linear-gradient(rgba(0,0,0,.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,.05) 1px, transparent 1px)
              `,
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            }}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            {storeItems.map((item) => (
              <div
                key={item.id}
                className="absolute cursor-move group"
                style={{
                  left: item.x,
                  top: item.y,
                  transform: `rotate(${item.rotation}deg)`,
                  transformOrigin: 'center center',
                }}
                onMouseDown={(e) => handleItemDragStart(e, item)}
                onClick={() => openProductDialog(item)}
              >
                <StoreItemComponent item={item} />
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none shadow-md font-semibold">
                  {item.name}
                </div>
                <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white rounded shadow-lg p-1 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      rotateItem(item.id);
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(item.id);
                    }}
                    className="p-1 hover:bg-red-100 text-red-600 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {(item.type === 'shelf' || item.type === 'fridge') &&
                  item.shelves &&
                  item.shelves.length > 0 && (
                    <div 
                      className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg animate-pulse"
                      title={`${item.shelves.length} produse salvate`}
                    >
                      ✓
                    </div>
                  )}
                {(item.type === 'shelf' || item.type === 'fridge') &&
                  (!item.shelves || item.shelves.length === 0) && (
                    <div 
                      className="absolute -top-2 -right-2 bg-yellow-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg"
                      title="Clic pentru a adăuga produse"
                    >
                      +
                    </div>
                  )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Product Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedItem?.type === 'fridge' ? '❄️ ' : '📦 '}
              {selectedItem?.name} - Produse
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-4">
              {editingShelves.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Niciun raft adăugat încă.</p>
                  <p className="text-sm">Apasă pe "Adaugă Raft" pentru a începe.</p>
                </div>
              ) : (
                editingShelves.map((shelf, index) => (
                  <Card key={index} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 bg-primary/10 rounded-lg px-3 py-2">
                        <Label className="font-bold text-primary">Raft #{shelf.shelfNumber}</Label>
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Denumire Produs</Label>
                        <Input
                          type="text"
                          placeholder="Ex: Lapte, Pâine, Apă..."
                          value={shelf.productName}
                          onChange={(e) =>
                            updateShelfRow(index, 'productName', e.target.value)
                          }
                          className="mt-1"
                        />
                      </div>
                      <div className="w-32">
                        <Label className="text-xs text-muted-foreground">Cantitate</Label>
                        <Input
                          type="number"
                          value={shelf.quantity}
                          onChange={(e) =>
                            updateShelfRow(index, 'quantity', parseInt(e.target.value) || 0)
                          }
                          min="0"
                          className="mt-1"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteShelfRow(index)}
                        className="text-red-600 hover:bg-red-50 self-end"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
              <Button onClick={addShelfRow} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Adaugă Raft
              </Button>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowProductDialog(false)}
              disabled={isSaving}
            >
              Închide
            </Button>
            <Button 
              type="button" 
              onClick={saveShelves}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 text-lg"
              size="lg"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Salvare...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  SALVEAZĂ
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
};

// Store Item Component
const StoreItemComponent: React.FC<{ item: StoreItem }> = ({ item }) => {
  const baseStyles = 'hover:shadow-2xl transition-all';

  // Door - double door style
  if (item.type === 'door') {
    return (
      <div
        className={`${baseStyles} relative`}
        style={{ width: 80, height: 40 }}
      >
        <svg width="80" height="40" viewBox="0 0 80 40" className="drop-shadow-lg">
          <rect x="0" y="0" width="38" height="40" fill="#d97706" stroke="#92400e" strokeWidth="2" rx="2"/>
          <rect x="42" y="0" width="38" height="40" fill="#d97706" stroke="#92400e" strokeWidth="2" rx="2"/>
          <circle cx="10" cy="20" r="2" fill="#92400e"/>
          <circle cx="70" cy="20" r="2" fill="#92400e"/>
          <line x1="4" y1="5" x2="34" y2="5" stroke="#fbbf24" strokeWidth="1"/>
          <line x1="46" y1="5" x2="76" y2="5" stroke="#fbbf24" strokeWidth="1"/>
        </svg>
      </div>
    );
  }

  // Fridge - realistic refrigerator
  if (item.type === 'fridge') {
    return (
      <div
        className={`${baseStyles} relative`}
        style={{ width: 80, height: 120 }}
      >
        <svg width="80" height="120" viewBox="0 0 80 120" className="drop-shadow-lg">
          <defs>
            <linearGradient id="fridgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="50%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="76" height="116" fill="url(#fridgeGrad)" stroke="#1e40af" strokeWidth="3" rx="4"/>
          <rect x="8" y="8" width="64" height="35" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" rx="2"/>
          <rect x="8" y="50" width="64" height="62" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" rx="2"/>
          <rect x="68" y="20" width="6" height="8" fill="#1e40af" rx="2"/>
          <rect x="68" y="75" width="6" height="12" fill="#1e40af" rx="2"/>
          <line x1="10" y1="46" x2="70" y2="46" stroke="#3b82f6" strokeWidth="2"/>
        </svg>
      </div>
    );
  }

  // Shelf - realistic shelf with multiple levels
  if (item.type === 'shelf') {
    return (
      <div
        className={`${baseStyles} relative`}
        style={{ width: 120, height: 80 }}
      >
        <svg width="120" height="80" viewBox="0 0 120 80" className="drop-shadow-lg">
          <defs>
            <linearGradient id="shelfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#4ade80" />
            </linearGradient>
          </defs>
          {/* Vertical supports */}
          <rect x="5" y="5" width="8" height="70" fill="#166534" rx="1"/>
          <rect x="107" y="5" width="8" height="70" fill="#166534" rx="1"/>
          
          {/* Shelves */}
          <rect x="5" y="15" width="110" height="6" fill="url(#shelfGrad)" stroke="#15803d" strokeWidth="1" rx="1"/>
          <rect x="5" y="37" width="110" height="6" fill="url(#shelfGrad)" stroke="#15803d" strokeWidth="1" rx="1"/>
          <rect x="5" y="59" width="110" height="6" fill="url(#shelfGrad)" stroke="#15803d" strokeWidth="1" rx="1"/>
          
          {/* Products representation */}
          <rect x="15" y="20" width="10" height="15" fill="#bbf7d0" stroke="#16a34a" strokeWidth="1" rx="1"/>
          <rect x="30" y="20" width="10" height="15" fill="#bbf7d0" stroke="#16a34a" strokeWidth="1" rx="1"/>
          <rect x="45" y="20" width="10" height="15" fill="#bbf7d0" stroke="#16a34a" strokeWidth="1" rx="1"/>
          
          <rect x="20" y="44" width="10" height="13" fill="#bbf7d0" stroke="#16a34a" strokeWidth="1" rx="1"/>
          <rect x="35" y="44" width="10" height="13" fill="#bbf7d0" stroke="#16a34a" strokeWidth="1" rx="1"/>
          <rect x="50" y="44" width="10" height="13" fill="#bbf7d0" stroke="#16a34a" strokeWidth="1" rx="1"/>
        </svg>
      </div>
    );
  }

  // Cashier - cash register counter
  if (item.type === 'cashier') {
    return (
      <div
        className={`${baseStyles} relative`}
        style={{ width: 80, height: 80 }}
      >
        <svg width="80" height="80" viewBox="0 0 80 80" className="drop-shadow-lg">
          <defs>
            <linearGradient id="cashierGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          {/* Counter base */}
          <rect x="5" y="45" width="70" height="30" fill="#7c3aed" stroke="#5b21b6" strokeWidth="2" rx="2"/>
          
          {/* Cash register */}
          <rect x="15" y="20" width="50" height="30" fill="url(#cashierGrad)" stroke="#6b21a8" strokeWidth="2" rx="3"/>
          
          {/* Screen */}
          <rect x="22" y="26" width="36" height="12" fill="#1e293b" stroke="#6b21a8" strokeWidth="1" rx="1"/>
          <rect x="24" y="28" width="32" height="8" fill="#10b981" opacity="0.7" rx="0.5"/>
          
          {/* Buttons */}
          <circle cx="28" cy="43" r="2" fill="#d8b4fe"/>
          <circle cx="36" cy="43" r="2" fill="#d8b4fe"/>
          <circle cx="44" cy="43" r="2" fill="#d8b4fe"/>
          <circle cx="52" cy="43" r="2" fill="#d8b4fe"/>
        </svg>
      </div>
    );
  }

  return null;
};

export default StorePlanogram;
