import { useState, useRef } from "react";
import { useMockTrpc } from "@/mock/useMockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Calendar, Save, Trash2, BarChart3, Edit3, X,
} from "lucide-react";

const baseMetals = [
  { key: "Sn", name: "锡", inputUnit: "¥/吨", toKgFactor: 1000 },
  { key: "Ag", name: "银", inputUnit: "¥/千克", toKgFactor: 1 },
  { key: "Cu", name: "铜", inputUnit: "¥/吨", toKgFactor: 1000 },
  { key: "Pb", name: "铅", inputUnit: "¥/吨", toKgFactor: 1000 },
  { key: "Sb", name: "锑", inputUnit: "¥/吨", toKgFactor: 1000 },
];
// 统一显示单位
const displayUnit = "¥/kg";

const metalColors: Record<string, string> = {
  Sn: "#3B82F6", Ag: "#F59E0B", Cu: "#EF4444", Pb: "#8B5CF6", Sb: "#10B981",
};
const alloyColors = ["#2563EB", "#DC2626", "#059669", "#D97706", "#7C3AED", "#DB2777"];
const baseMetalYAxisMin: Record<string, number> = {
  "Sn": 250,
  "Ag": 13000,
  "Cu": 90,
  "Pb": 15,
  "Sb": 100,
};
const alloyYAxisMin: Record<string, number> = {
  "Sn96.5Ag3.0Cu0.5": 650,
  "Sn98.5Ag1.0Cu0.5": 400,
  "Sn99Ag0.3Cu0.7": 300,
  "Sn63Pb37": 150,
  "Pb75.5Sn16Sb7.5Ag1": 150,
  "Pb92.5Sn5Ag2.5": 300,
};

type ChartDimension = "week" | "month" | "year";
type ActiveTab = "record" | "history" | "trend";

export default function MetalPrices() {
  const trpc = useMockTrpc();
  const { data: alloys } = trpc.metalPrice.alloys.useQuery();
  const { data: listData, refetch: refetchList } = trpc.metalPrice.list.useQuery({});
  const { data: monthlyAvgList } = trpc.metalPrice.monthlyAvgList.useQuery();
  const saveMutation = trpc.metalPrice.save.useMutation({
    onSuccess: () => { toast.success("价格记录已保存"); refetchList(); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteMutation = trpc.metalPrice.delete.useMutation({
    onSuccess: () => { toast.success("记录已删除"); refetchList(); },
    onError: (err: any) => toast.error(err.message),
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>("record");
  const [chartDimension, setChartDimension] = useState<ChartDimension>("month");

  // 历史记录日期筛选
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  const { data: chartData } = trpc.metalPrice.chartData.useQuery({ dimension: chartDimension });

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [prices, setPrices] = useState<Record<string, string>>({
    Sn: "", Ag: "", Cu: "", Pb: "", Sb: "",
  });
  // 基础金属输入框 ref，用于左右键导航
  const metalInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const handleMetalKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      metalInputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < baseMetals.length - 1) {
      e.preventDefault();
      metalInputRefs.current[index + 1]?.focus();
    }
  };

  const handleSave = () => {
    const priceRecord: Record<string, number> = {};
    for (const m of baseMetals) {
      const v = parseFloat(prices[m.key]);
      if (isNaN(v) || v <= 0) { toast.error(`${m.name}价格无效`); return; }
      // 统一换算为 ¥/kg 存入数据库
      priceRecord[m.key] = v / m.toKgFactor;
    }
    saveMutation.mutate({ date, prices: priceRecord });
  };

  // Preview alloy prices (使用换算为 ¥/kg 后的值计算)
  const previewAlloyPrices: Record<string, number> = {};
  if (alloys && baseMetals.every(m => prices[m.key] && parseFloat(prices[m.key]) > 0)) {
    for (const alloy of alloys) {
      let total = 0;
      for (const [metal, ratio] of Object.entries(alloy.formula)) {
        const metalDef = baseMetals.find(m => m.key === metal);
        const kgPrice = parseFloat(prices[metal] || "0") / (metalDef?.toKgFactor ?? 1);
        total += kgPrice * (ratio as number);
      }
      previewAlloyPrices[alloy.name] = Math.round(total * 100) / 100;
    }
  }

  const dimensionLabels: Record<ChartDimension, string> = {
    week: "近8周",
    month: "近12个月",
    year: "近5年月均",
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Tab Switcher */}
      <div className="flex items-center gap-0 bg-white rounded-lg border p-1 w-fit">
        <button
          onClick={() => setActiveTab("record")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "record" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
        >
          <Edit3 size={15} />价格录入
        </button>
        <button
          onClick={() => setActiveTab("trend")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "trend" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
        >
          <TrendingUp size={15} />价格走势
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "history" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
        >
          <Calendar size={15} />历史记录
        </button>
      </div>

      {activeTab === "record" ? (
        <>
          {/* Daily Price Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Edit3 size={18} className="text-blue-500" />
                每日金属价格录入
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Label className="text-xs text-gray-500 shrink-0">日期</Label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 border rounded-md px-3 text-sm" />
              </div>
              <div className="grid grid-cols-5 gap-3">
                {baseMetals.map((m, i) => (
                  <div key={m.key}>
                    <Label className="text-xs text-gray-500">{m.name}({m.key}) <span className="text-gray-300">{m.inputUnit}（存为{displayUnit}）</span></Label>
                    <Input
                      ref={el => { metalInputRefs.current[i] = el; }}
                      className="mt-1"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={prices[m.key]}
                      onChange={e => setPrices(p => ({ ...p, [m.key]: e.target.value }))}
                      onKeyDown={e => handleMetalKeyDown(i, e)}
                    />
                  </div>
                ))}
              </div>
              {Object.keys(previewAlloyPrices).length > 0 && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600 font-medium mb-2">合金价格计算预览</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(previewAlloyPrices).map(([name, price]) => (
                      <div key={name} className="flex items-center justify-between bg-white rounded-md px-3 py-2">
                        <span className="text-xs font-medium text-gray-700">{name}</span>
                        <span className="text-sm font-bold text-blue-700">¥{price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                  <Save size={16} className="mr-1" />{saveMutation.isPending ? "保存中..." : "保存记录"}
                </Button>
              </div>
            </CardContent>
          </Card>


        </>
      ) : activeTab === "history" ? (
        <>
          {/* History Cards */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-orange-500" />
              <h3 className="text-base font-semibold">历史价格记录</h3>
            </div>
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">从</span>
              <input
                type="date"
                value={historyStartDate}
                onChange={e => setHistoryStartDate(e.target.value)}
                className="h-8 border rounded-md px-2 text-xs"
              />
              <span className="text-xs text-gray-400">到</span>
              <input
                type="date"
                value={historyEndDate}
                onChange={e => setHistoryEndDate(e.target.value)}
                className="h-8 border rounded-md px-2 text-xs"
              />
              {(historyStartDate || historyEndDate) && (
                <button
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  title="清除筛选"
                  onClick={() => { setHistoryStartDate(""); setHistoryEndDate(""); }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {(() => {
            let filteredItems = listData?.items ?? [];
            if (historyStartDate) filteredItems = filteredItems.filter((item: any) => item.date >= historyStartDate);
            if (historyEndDate) filteredItems = filteredItems.filter((item: any) => item.date <= historyEndDate);
            return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-gray-100 text-gray-500 text-xs">{filteredItems.length}条</Badge>
              {(historyStartDate || historyEndDate) && filteredItems.length !== (listData?.items.length ?? 0) && (
                <span className="text-xs text-gray-400">共 {listData?.items.length ?? 0} 条</span>
              )}
            </div>
            {filteredItems.map((item: any) => (
              <div key={item.date} className="bg-white rounded-lg border hover:shadow-md transition-shadow">
                {/* Card Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50/50 rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{item.date}</span>
                    <span className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString("zh-CN", { weekday: "short" })}</span>
                  </div>
                  <button
                    className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                    title="删除"
                    onClick={() => { if (confirm(`确定删除 ${item.date} 的价格记录？`)) deleteMutation.mutate({ date: item.date }); }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {/* Base Metals */}
                <div className="px-4 py-3">
                  <p className="text-[10px] text-gray-400 font-medium mb-2 uppercase tracking-wider">基础金属</p>
                  <div className="grid grid-cols-5 gap-2">
                    {baseMetals.map(m => (
                      <div key={m.key} className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: metalColors[m.key] }} />
                          <span className="text-xs text-gray-500">{m.name}</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-800">
                          {item.prices?.[m.key] ? `¥${Number(item.prices[m.key]).toFixed(2)}` : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Alloy Prices */}
                {alloys && alloys.length > 0 && (
                  <div className="px-4 py-3 border-t bg-blue-50/30">
                    <p className="text-[10px] text-blue-400 font-medium mb-2 uppercase tracking-wider">合金价格</p>
                    <div className="grid grid-cols-3 gap-2">
                      {alloys.map((a: any, idx: number) => (
                        <div key={a.name} className="flex items-center justify-between bg-white rounded-md px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: alloyColors[idx % alloyColors.length] }} />
                            <span className="text-xs text-gray-600 truncate">{a.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-blue-700">
                            {item.alloyPrices?.[a.name] ? `¥${Number(item.alloyPrices[a.name]).toFixed(2)}` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-gray-300 bg-white rounded-lg border">
                <TrendingUp size={32} className="mx-auto mb-2" />
                <p className="text-sm">
                  {historyStartDate || historyEndDate ? "该日期范围内暂无记录" : "暂无价格记录"}
                </p>
              </div>
            )}
          </div>
            );
          })()}
        </>
      ) : (
        <>
          {/* Charts with dimension toggle */}
          {chartData && chartData.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">时间维度</span>
                {(["week", "month", "year"] as ChartDimension[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setChartDimension(d)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${chartDimension === d ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >
                    {dimensionLabels[d]}
                  </button>
                ))}
              </div>

              {/* Base Metal Charts - each metal has its own chart */}
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-500" />
                <h3 className="text-base font-semibold">基础金属价格走势 · {dimensionLabels[chartDimension]}</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {baseMetals.map(m => (
                  <Card key={m.key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: metalColors[m.key] }} />
                        {m.name}({m.key})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                          <YAxis domain={[baseMetalYAxisMin[m.key] ?? 0, "auto"]} tick={{ fontSize: 10, fill: "#9CA3AF" }} tickFormatter={(v: number) => `¥${v}`} width={50} />
                          <Tooltip formatter={(value: any) => typeof value === "number" ? `¥${value.toFixed(2)}` : value} />
                          <Line type="monotone" dataKey={m.key} name={`${m.name}(${m.key})`} stroke={metalColors[m.key]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Alloy Charts - each alloy has its own chart */}
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-purple-500" />
                <h3 className="text-base font-semibold">合金价格走势 · {dimensionLabels[chartDimension]}</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {alloys?.map((alloy: any, idx: number) => (
                  <Card key={alloy.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: alloyColors[idx % alloyColors.length] }} />
                        {alloy.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                          <YAxis domain={[alloyYAxisMin[alloy.name] ?? 0, "auto"]} tick={{ fontSize: 10, fill: "#9CA3AF" }} tickFormatter={(v: number) => `¥${v}`} width={50} />
                          <Tooltip formatter={(value: any) => typeof value === "number" ? `¥${value.toFixed(2)}` : value} />
                          <Line type="monotone" dataKey={alloy.name} name={alloy.name} stroke={alloyColors[idx % alloyColors.length]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-300">
                <TrendingUp size={40} className="mx-auto mb-2" />
                <p className="text-sm">暂无足够数据绘制图表，请先录入价格记录</p>
              </CardContent>
            </Card>
          )}

          {/* Monthly Average List */}
          {monthlyAvgList && monthlyAvgList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 size={18} className="text-orange-500" />
                  各月平均价格
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2 sticky left-0 bg-gray-50">月份</th>
                        <th className="text-center text-xs font-semibold text-gray-500 px-2 py-2">天数</th>
                        {baseMetals.map(m => (
                          <th key={m.key} className="text-right text-xs font-semibold text-gray-500 px-3 py-2">{m.name}({m.key})</th>
                        ))}
                        {alloys?.map((a: any) => (
                          <th key={a.name} className="text-right text-xs font-semibold text-gray-500 px-3 py-2">{a.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyAvgList.map((item: any) => (
                        <tr key={item.month} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors">
                          <td className="px-4 py-2 text-xs font-medium text-gray-700 sticky left-0 bg-white">{item.month}</td>
                          <td className="text-center px-2 py-2">
                            <Badge className="bg-gray-100 text-gray-600 text-[10px]">{item.count}天</Badge>
                          </td>
                          {baseMetals.map(m => (
                            <td key={m.key} className="text-right px-3 py-2 text-xs text-gray-600">
                              {item.metalAvgs?.[m.key] ? `¥${item.metalAvgs[m.key].toFixed(2)}` : "—"}
                            </td>
                          ))}
                          {alloys?.map((a: any) => (
                            <td key={a.name} className="text-right px-3 py-2 text-xs font-medium text-blue-700">
                              {item.alloyAvgs?.[a.name] ? `¥${item.alloyAvgs[a.name].toFixed(2)}` : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
