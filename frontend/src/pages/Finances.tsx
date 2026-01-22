import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  PiggyBank,
  Plus,
  Trash2,
  Calendar,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  recurring: boolean;
  recurring_period?: string;
  notes?: string;
}

interface DashboardStats {
  revenue: {
    current: number;
    previous: number;
    change_percent: number;
  };
  expenses: {
    current: number;
    previous: number;
    change_percent: number;
    operational: number;
    purchase_orders: number;
  };
  profit: {
    current: number;
    previous: number;
    change_percent: number;
    margin_percent: number;
  };
}

const EXPENSE_CATEGORIES = [
  'Utilities',
  'Rent',
  'Salaries',
  'Electricity',
  'Water',
  'Internet',
  'Marketing',
  'Maintenance',
  'Insurance',
  'Other',
];

const Finances: React.FC = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [yearlyStats, setYearlyStats] = useState<DashboardStats | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [yearlyLoading, setYearlyLoading] = useState(true);

  const [newExpense, setNewExpense] = useState({
    category: 'Utilities',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    recurring: false,
    recurring_period: 'monthly',
    notes: '',
  });

  useEffect(() => {
    fetchStats();
    fetchYearlyStats();
    fetchExpenses();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/finances/dashboard-stats?days=30', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchYearlyStats = async () => {
    setYearlyLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      console.log('Fetching yearly stats...');
      const response = await fetch('http://localhost:8000/api/finances/dashboard-stats?days=365', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Yearly stats response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Yearly stats data:', data);
        setYearlyStats(data);
      }
    } catch (error) {
      console.error('Error fetching yearly stats:', error);
    } finally {
      setYearlyLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const token = localStorage.getItem('access_token');
      console.log('Fetching expenses...');
      const response = await fetch('http://localhost:8000/api/finances/expenses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Expenses response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Expenses data:', data);
        setExpenses(data);
      } else {
        const errorData = await response.json();
        console.error('Error fetching expenses:', errorData);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const handleAddExpense = async () => {
    if (loading) return; // Prevent multiple submissions
    
    if (!newExpense.description || newExpense.amount <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://localhost:8000/api/finances/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newExpense,
          date: new Date(newExpense.date).toISOString(),
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Expense added successfully',
        });
        setShowAddDialog(false);
        setNewExpense({
          category: 'Utilities',
          description: '',
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          recurring: false,
          recurring_period: 'monthly',
          notes: '',
        });
        fetchExpenses();
        fetchStats();
      } else {
        toast({
          title: 'Error',
          description: responseData.detail || 'Failed to add expense',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to add expense',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8000/api/finances/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Expense deleted',
        });
        fetchExpenses();
        fetchStats();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete expense',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    const value = percent.toFixed(1);
    return percent >= 0 ? `+${value}%` : `${value}%`;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              💰 Profit & Loss
            </h1>
            <p className="text-gray-600">
              Track your revenue, expenses, and profitability
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>

        {/* Key Metrics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Revenue */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold">Revenue</h3>
                </div>
                {stats.revenue.change_percent >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div className="text-3xl font-bold">{formatCurrency(stats.revenue.current)}</div>
              <div className={`text-sm mt-2 ${stats.revenue.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(stats.revenue.change_percent)} vs last month
              </div>
            </Card>

            {/* Expenses */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="bg-red-100 p-3 rounded-lg">
                    <CreditCard className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold">Expenses</h3>
                </div>
                {stats.expenses.change_percent >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-red-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-green-600" />
                )}
              </div>
              <div className="text-3xl font-bold">{formatCurrency(stats.expenses.current)}</div>
              <div className="text-sm mt-2 text-gray-600">
                Operational: {formatCurrency(stats.expenses.operational)} | 
                Purchase Orders: {formatCurrency(stats.expenses.purchase_orders)}
              </div>
            </Card>

            {/* Net Profit */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className={`${stats.profit.current >= 0 ? 'bg-blue-100' : 'bg-red-100'} p-3 rounded-lg`}>
                    <PiggyBank className={`w-6 h-6 ${stats.profit.current >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold">Net Profit</h3>
                </div>
                {stats.profit.change_percent >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div className={`text-3xl font-bold ${stats.profit.current >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(stats.profit.current)}
              </div>
              <div className="text-sm mt-2 text-gray-600">
                Margin: {stats.profit.margin_percent.toFixed(1)}%
              </div>
            </Card>
          </div>
        )}

        {/* Yearly Financial Charts */}
        {yearlyLoading ? (
            <Card className="p-6 mb-6">
              <p className="text-center text-gray-500">Loading yearly statistics...</p>
            </Card>
        ) : yearlyStats ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Pie Chart - Revenue vs Expenses */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Annual Financial Breakdown (Last 365 Days)</h2>
              <div className="text-sm text-gray-600 mb-4">
                Revenue: {formatCurrency(yearlyStats.revenue.current)} | 
                Expenses: {formatCurrency(yearlyStats.expenses.current)} | 
                Profit: {formatCurrency(yearlyStats.profit.current)}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Revenue', value: yearlyStats.revenue.current, color: '#10b981' },
                      { name: 'Expenses', value: yearlyStats.expenses.current, color: '#ef4444' },
                      { name: 'Profit', value: yearlyStats.profit.current >= 0 ? yearlyStats.profit.current : 0, color: '#3b82f6' },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'Revenue', value: yearlyStats.revenue.current, color: '#10b981' },
                      { name: 'Expenses', value: yearlyStats.expenses.current, color: '#ef4444' },
                      { name: 'Profit', value: yearlyStats.profit.current >= 0 ? yearlyStats.profit.current : 0, color: '#3b82f6' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Bar Chart - Expense Breakdown */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Expense Breakdown (Last 365 Days)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: 'Operational', amount: yearlyStats.expenses.operational, color: '#f59e0b' },
                    { name: 'Purchase Orders', amount: yearlyStats.expenses.purchase_orders, color: '#8b5cf6' },
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="amount" fill="#8884d8">
                    {[
                      { name: 'Operational', amount: yearlyStats.expenses.operational, color: '#f59e0b' },
                      { name: 'Purchase Orders', amount: yearlyStats.expenses.purchase_orders, color: '#8b5cf6' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Operational Expenses:</p>
                  <p className="font-bold text-orange-600">{formatCurrency(yearlyStats.expenses.operational)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Purchase Orders:</p>
                  <p className="font-bold text-purple-600">{formatCurrency(yearlyStats.expenses.purchase_orders)}</p>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-6 mb-6">
            <p className="text-center text-gray-500">Loading yearly statistics...</p>
          </Card>
        )}

        {/* Expenses List */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Recent Expenses</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-left p-3">Description</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-center p-3">Recurring</th>
                  <th className="text-center p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-gray-500">
                      No expenses recorded yet. Add your first expense to start tracking.
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{new Date(expense.date).toLocaleDateString()}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {expense.category}
                        </span>
                      </td>
                      <td className="p-3">{expense.description}</td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(expense.amount)}</td>
                      <td className="p-3 text-center">
                        {expense.recurring ? (
                          <span className="text-green-600">✓ {expense.recurring_period}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add Expense Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={newExpense.category}
                  onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Description *</Label>
                <Input
                  placeholder="e.g., Monthly electricity bill"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                />
              </div>

              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newExpense.amount || ''}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={newExpense.recurring}
                  onChange={(e) => setNewExpense({ ...newExpense, recurring: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="recurring">Recurring Expense</Label>
              </div>

              {newExpense.recurring && (
                <div>
                  <Label>Period</Label>
                  <Select
                    value={newExpense.recurring_period}
                    onValueChange={(value) => setNewExpense({ ...newExpense, recurring_period: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Notes (Optional)</Label>
                <Input
                  placeholder="Additional notes..."
                  value={newExpense.notes}
                  onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleAddExpense} disabled={loading}>
                {loading ? 'Adding...' : 'Add Expense'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Finances;
