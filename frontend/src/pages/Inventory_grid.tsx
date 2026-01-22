import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import {
    DataGrid,
    GridColDef,
    GridToolbarContainer,
    GridToolbarExport,
    GridToolbarQuickFilter
} from '@mui/x-data-grid';
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
    Filter,
    Calendar,
    AlertTriangle,
    CheckCircle2,
    Layers,
    Activity,
    Download,
    Search,
    Zap,
    Info
} from "lucide-react";
import {
    Box,
    MenuItem,
    Select,
    FormControl
} from '@mui/material';

interface InventoryRow {
    id: string;
    sku: string;
    name: string;
    category: string;
    current_stock: number;
    reorder_point: number;
    sales_7d: number;
    doc: number;
}

// --- NEW COMPONENT: INVENTORY LEGEND ---
const InventoryLegend = () => (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-4 py-2 bg-white/40 backdrop-blur-sm rounded-xl border border-white/20 shadow-sm animate-fade-in">
        <div className="flex items-center gap-2">
            <div className="p-1 bg-blue-100 rounded text-blue-600">
                <Info size={12} />
            </div>
            <span className="text-[10px] font-medium text-slate-500">
                <strong className="text-slate-700 uppercase">Min. Safety:</strong> The critical reorder threshold. If stock falls below this, the status turns red.
            </span>
        </div>
        <div className="flex items-center gap-2">
            <Activity size={14} className="text-emerald-500" />
            <span className="text-[10px] font-medium text-slate-500">
                <strong className="text-slate-700 uppercase">7D Velocity:</strong> Sales speed; total units sold in the last 7 days.
            </span>
        </div>
        <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-slate-400" />
            <span className="text-[10px] font-medium text-slate-500">
                <strong className="text-slate-700 uppercase">DOC (Days of Coverage):</strong> Stock autonomy; estimated days until current stock runs out.
            </span>
        </div>
    </div>
);

const InventoryGridPage = () => {
    const { storeId } = useParams<{ storeId: string }>();
    const navigate = useNavigate();
    const [rows, setRows] = useState<InventoryRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [category, setCategory] = useState('All');
    const [period, setPeriod] = useState(30);
    const [dbCategories, setDbCategories] = useState<string[]>([]);

    const uniqueProductsCount = rows.length;

    function CustomToolbar() {
        return (
            <GridToolbarContainer className="flex justify-between p-2 border-b border-slate-100 bg-slate-50/50">
                <Box className="flex items-center gap-2">
                    <Search size={14} className="text-slate-400 ml-2" />
                    <GridToolbarQuickFilter
                        variant="standard"
                        placeholder="Quick search..."
                        className="text-xs font-medium"
                    />
                </Box>
                <GridToolbarExport
                    startIcon={<Download size={14} />}
                    className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg"
                    csvOptions={{ fileName: `Inventory_${storeId}` }}
                />
            </GridToolbarContainer>
        );
    }

    const fetchCategories = async () => {
        if (!storeId) return;
        try {
            const token = localStorage.getItem("access_token");
            const response = await fetch(`http://localhost:8000/api/inventory_grid/categories/${storeId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setDbCategories(data || []);
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    const fetchInventoryData = async () => {
        if (!storeId) return;
        try {
            setLoading(true);
            const token = localStorage.getItem("access_token");
            let url = `http://localhost:8000/api/inventory_grid/grid-data/${storeId}?days_period=${period}`;
            if (category !== 'All') url += `&category=${category}`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            setRows(data || []);
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCategories(); }, [storeId]);
    useEffect(() => { fetchInventoryData(); }, [storeId, category, period]);

    const columns: GridColDef[] = [
        { field: 'sku', headerName: 'SKU', width: 130, renderCell: (params) => <span className="font-mono text-[10px] font-bold text-slate-500">{params.value}</span> },
        { field: 'name', headerName: 'Product Name', flex: 1.2, renderCell: (params) => <span className="font-semibold text-xs text-slate-700 truncate">{params.value}</span> },
        { field: 'category', headerName: 'Category', width: 110, renderCell: (params) => <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded uppercase">{params.value}</span> },
        {
            field: 'current_stock',
            headerName: 'Stock Status',
            type: 'number',
            width: 140,
            renderCell: (params) => {
                const stock = params.value as number;
                const reorder = params.row.reorder_point || 0;
                const percentage = Math.min((stock / (reorder * 2 || 100)) * 100, 100);
                return (
                    <Box className="w-full flex flex-col gap-1 pr-4">
                        <div className="flex items-center justify-between"><span className="font-black text-slate-900 text-xs">{stock}</span></div>
                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: stock <= reorder ? '#ef4444' : '#3b82f6' }} />
                        </div>
                    </Box>
                );
            }
        },
        { field: 'reorder_point', headerName: 'Min. Safety', type: 'number', width: 100, renderCell: (params) => <span className="text-[10px] font-bold text-slate-400 italic">Target: {params.value || 0}</span> },
        { field: 'sales_7d', headerName: '7D Velocity', type: 'number', width: 100, renderCell: (params) => <div className="flex items-center gap-1"><Activity size={12} className="text-emerald-500" /><span className="text-xs font-black text-slate-700">{params.value || 0}</span></div> },
        {
            field: 'doc',
            headerName: 'DOC',
            width: 110,
            renderCell: (params) => {
                const value = params.value as number;
                let styles = "bg-emerald-50 text-emerald-600 border-emerald-100";
                let Icon = CheckCircle2;
                if (value === -1) return <span className="text-slate-400 italic text-[10px]">No sales</span>;
                if (value < 7) { styles = "bg-rose-50 text-rose-600 border-rose-100"; Icon = AlertTriangle; }
                else if (value < 15) { styles = "bg-amber-50 text-amber-600 border-amber-100"; Icon = Activity; }
                return ( <div className={`flex items-center gap-1 px-2 py-0.5 rounded border font-bold text-[10px] ${styles}`}><Icon size={12} />{value === 999 ? '∞' : `${value} d`}</div> );
            }
        },
    ];

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-20px)] w-full space-y-4 p-4 overflow-hidden animate-in fade-in duration-500">

                <div className="flex items-center justify-between gap-4 shrink-0 mt-2">
                    <Card className="border-none shadow-sm bg-white/60 backdrop-blur-md min-w-[200px]">
                        <CardContent className="py-2 px-4 flex items-center gap-3">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shadow-inner"><Layers size={18} /></div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">SKU Portfolio</span>
                                <span className="text-lg font-black text-slate-900 leading-none">{uniqueProductsCount}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/inventory/${storeId}`)}
                            className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold text-indigo-600 bg-white border border-indigo-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm active:scale-95"
                        >
                            <Zap size={14} className="fill-indigo-500 text-indigo-500" />
                            Optimization
                        </button>

                        <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm px-2 py-1 rounded-xl border border-white/40 shadow-sm">
                            <div className="flex items-center gap-1.5">
                                <Filter size={14} className="text-slate-400" />
                                <FormControl variant="standard" sx={{ minWidth: 150 }}>
                                    <Select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value as string)}
                                        disableUnderline
                                        className="text-xs font-bold text-slate-600"
                                    >
                                        <MenuItem value="All">All Categories</MenuItem>
                                        {dbCategories.map((cat) => (
                                            <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </div>
                            <div className="h-4 w-[1px] bg-slate-200 mx-1" />
                            <div className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-slate-400" />
                                <FormControl variant="standard" sx={{ minWidth: 110 }}>
                                    <Select value={period} onChange={(e) => setPeriod(Number(e.target.value))} disableUnderline className="text-xs font-bold text-slate-600">
                                        <MenuItem value={7}>7 Days</MenuItem>
                                        <MenuItem value={30}>30 Days</MenuItem>
                                        <MenuItem value={90}>90 Days</MenuItem>
                                    </Select>
                                </FormControl>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- LEGEND SECTION --- */}
                <InventoryLegend />

                <Card className="flex-1 shadow-2xl border-none bg-white/90 backdrop-blur-md rounded-2xl overflow-hidden min-h-0">
                    <CardContent className="p-0 h-full w-full">
                        <DataGrid
                            rows={rows}
                            columns={columns}
                            loading={loading}
                            disableRowSelectionOnClick
                            density="compact"
                            slots={{ toolbar: CustomToolbar }}
                            autoHeight={false}
                            pageSizeOptions={[25, 50, 100]}
                            initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
                            sx={{
                                border: 'none',
                                height: '100%',
                                '& .MuiDataGrid-columnHeaders': {
                                    bgcolor: 'rgba(248, 250, 252, 0.8)',
                                    color: '#64748b',
                                    fontSize: '0.6rem',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 1,
                                },
                                '& .MuiDataGrid-cell': { borderBottom: '1px solid #f1f5f9' },
                                '& .MuiDataGrid-virtualScroller': { overflowX: 'auto' },
                            }}
                        />
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default InventoryGridPage;