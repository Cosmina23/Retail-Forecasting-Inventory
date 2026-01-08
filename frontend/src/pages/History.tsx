import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingDown, Package, ShoppingCart, Activity, Info } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const History = () => {
	const params = useParams();
	const routeStoreId = params.storeId || null;
	const [monthlyData, setMonthlyData] = useState<any[]>([]);
	const [recentActivity, setRecentActivity] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const sel = routeStoreId ? null : localStorage.getItem("selectedStore");
		const storeId =
			routeStoreId ||
			(sel
				? (() => {
						try {
							return JSON.parse(sel)._id || JSON.parse(sel).id;
						} catch {
							return null;
						}
				  })()
				: null);

		if (!storeId) {
			setLoading(false);
			return;
		}

		fetchHistory(storeId);
	}, [routeStoreId]);

	const fetchHistory = async (storeId: string) => {
		setLoading(true);
		const base = "http://localhost:8000/api";
		try {
			const [resMonthly, resActivity] = await Promise.all([
				fetch(`${base}/sales/monthly?store_id=${storeId}`),
				fetch(`${base}/activity?store_id=${storeId}`)
			]);

			if (resMonthly.ok) {
				const data = await resMonthly.json();
				setMonthlyData(data);
			}

			if (resActivity.ok) {
				const data = await resActivity.json();
				setRecentActivity(data);
			}
		} catch (e) {
			console.error("Failed to fetch history", e);
		} finally {
			setLoading(false);
		}
	};

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "EUR",
			minimumFractionDigits: 0,
		}).format(value);
	};

	const getActivityIcon = (type: string) => {
		switch (type) {
			case "sale":
				return <ShoppingCart className="w-4 h-4" />;
			case "restock":
				return <Package className="w-4 h-4" />;
			default:
				return <TrendingDown className="w-4 h-4" />;
		}
	};

	const getActivityBadge = (type: string) => {
		switch (type) {
			case "sale":
				return (
					<Badge className="bg-success/10 text-success hover:bg-success/20">
						Sale
					</Badge>
				);
			case "restock":
				return (
					<Badge className="bg-primary/10 text-primary hover:bg-primary/20">
						Restock
					</Badge>
				);
			default:
				return (
					<Badge className="bg-warning/10 text-warning hover:bg-warning/20">
						Alert
					</Badge>
				);
		}
	};

	if (loading) {
		return (
			<DashboardLayout>
				<div className="min-h-screen flex items-center justify-center">
					<div className="text-center space-y-4">
						<Activity className="w-12 h-12 text-primary mx-auto animate-pulse" />
						<p className="text-muted-foreground">Loading history...</p>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="space-y-6">
				{/* Monthly Performance */}
				{monthlyData.length === 0 ? (
					<div className="p-12 border-2 border-dashed rounded-xl text-center space-y-4 animate-fade-up bg-card">
						<div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto">
							<Info className="w-8 h-8 text-muted-foreground" />
						</div>
						<h3 className="text-xl font-semibold">No Historical Data Available</h3>
						<p className="text-sm text-muted-foreground max-w-md mx-auto">
							Start recording sales and inventory changes to see your store's historical performance trends.
						</p>
					</div>
				) : (
					<>
						{/* Monthly Revenue Trend */}
						<Card className="animate-fade-up overflow-hidden border shadow-sm hover:shadow-md transition-shadow duration-300">
							<CardHeader className="bg-muted/50 border-b">
								<div className="flex items-center justify-between">
									<CardTitle className="text-lg font-semibold flex items-center gap-2">
										<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
											<Calendar className="w-4 h-4 text-primary" />
										</div>
										Monthly Revenue Trend
									</CardTitle>
									<Badge variant="outline" className="text-xs">
										Last 6 months
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="p-6">
								<div className="h-[320px]">
									<ResponsiveContainer width="100%" height="100%">
										<LineChart
											data={monthlyData}
											margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
										>
											<defs>
												<linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
													<stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
													<stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
												</linearGradient>
											</defs>
											<CartesianGrid
												strokeDasharray="3 3"
												vertical={false}
												stroke="hsl(var(--border))"
												opacity={0.3}
											/>
											<XAxis
												dataKey="month"
												stroke="hsl(var(--muted-foreground))"
												fontSize={12}
												tickMargin={10}
												axisLine={{ stroke: 'hsl(var(--border))' }}
											/>
											<YAxis
												tickFormatter={(v) => `€${v / 1000}k`}
												stroke="hsl(var(--muted-foreground))"
												fontSize={12}
												tickMargin={10}
												axisLine={{ stroke: 'hsl(var(--border))' }}
											/>
											<Tooltip
												formatter={(value: number) => formatCurrency(value)}
												contentStyle={{
													backgroundColor: "hsl(var(--card))",
													border: "1px solid hsl(var(--border))",
													borderRadius: "8px",
													boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
												}}
											/>
											<Legend
												wrapperStyle={{ paddingTop: '20px' }}
												iconType="circle"
											/>
											<Line
												type="monotone"
												dataKey="revenue"
												stroke="hsl(var(--chart-1))"
												strokeWidth={3}
												dot={{
													fill: "hsl(var(--chart-1))",
													strokeWidth: 2,
													r: 5,
												}}
												activeDot={{
													r: 7,
													fill: "hsl(var(--chart-1))",
													strokeWidth: 2,
													stroke: "hsl(var(--background))"
												}}
												name="Revenue"
												fill="url(#colorRevenue)"
											/>
										</LineChart>
									</ResponsiveContainer>
								</div>
							</CardContent>
						</Card>

						{/* Recent Activity */}
						{recentActivity.length > 0 && (
							<Card
								className="animate-fade-up overflow-hidden border shadow-sm hover:shadow-md transition-shadow duration-300"
								style={{ animationDelay: "0.1s" }}
							>
								<CardHeader className="bg-muted/50 border-b">
									<CardTitle className="text-lg font-semibold flex items-center gap-2">
										<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
											<Activity className="w-4 h-4 text-primary" />
										</div>
										Recent Activity
									</CardTitle>
								</CardHeader>
								<CardContent className="p-0">
									<div className="divide-y">
										{recentActivity.map((activity, index) => (
											<div
												key={index}
												className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
											>
												<div className="flex items-center gap-4">
													<div
														className={`w-10 h-10 rounded-lg flex items-center justify-center ${
															activity.type === "sale"
																? "bg-success/10 text-success"
																: activity.type === "restock"
																? "bg-primary/10 text-primary"
																: "bg-warning/10 text-warning"
														}`}
													>
														{getActivityIcon(activity.type)}
													</div>
													<div>
														<p className="font-medium text-foreground">
															{activity.description}
														</p>
														<p className="text-sm text-muted-foreground">
															{activity.date}
														</p>
													</div>
												</div>
												<div className="flex items-center gap-4">
													{getActivityBadge(activity.type)}
													<span
														className={`font-semibold ${
															activity.positive
																? "text-success"
																: "text-warning"
														}`}
													>
														{activity.value}
													</span>
												</div>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						)}
					</>
				)}
			</div>
		</DashboardLayout>
	);
};

export default History;

