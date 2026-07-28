import { useState } from "react";
import { useMockTrpc } from "@/mock/useMockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "react-router";
import { Search, Pencil, Trash2, X, TrendingUp, Eye, CheckCircle, XCircle, FileText, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function QuotationRecords() {
  const [search, setSearch] = useState("");
  const [recordStatusFilter, setRecordStatusFilter] = useState<"all" | "successful" | "unsuccessful">("all");

  // 修改加价 & 查看详情状态
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<"fixedPrice" | "total">("fixedPrice");
  const [editFixedPrice, setEditFixedPrice] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [detailRecord, setDetailRecord] = useState<any>(null);

  const trpc = useMockTrpc();

  // 报价记录
  const { data: recordsData, refetch: refetchRecords } = trpc.quotationRecord.list.useQuery({
    search: search || undefined,
    isSuccessful: recordStatusFilter === "all" ? undefined : recordStatusFilter === "successful",
  });
  const deleteRecord = trpc.quotationRecord.delete.useMutation({
    onSuccess: () => { toast.success("报价记录已删除"); refetchRecords(); },
  });
  const updateRecord = trpc.quotationRecord.update.useMutation({
    onSuccess: () => { toast.success("加价已修改并重新计算"); refetchRecords(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updateRecordStatus = trpc.quotationRecord.updateStatus.useMutation({
    onSuccess: () => { toast.success("状态已更新"); refetchRecords(); },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
        <Link to="/quotation-rules" className="hover:text-blue-600 transition-colors flex items-center gap-1">
          <FileText size={14} />报价规则
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-700 font-medium">报价记录</span>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input placeholder="搜索客户或产品..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setRecordStatusFilter("all")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${recordStatusFilter === "all" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >全部</button>
              <button
                onClick={() => setRecordStatusFilter("successful")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${recordStatusFilter === "successful" ? "bg-green-600 text-white" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
              >成交</button>
              <button
                onClick={() => setRecordStatusFilter("unsuccessful")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${recordStatusFilter === "unsuccessful" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >未成交</button>
            </div>
            <Link to="/quotation-rules">
              <Button size="sm" variant="outline"><FileText size={16} className="mr-1" />报价规则</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Quotation Records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp size={18} />报价记录</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-500">日期</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500">客户</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500">产品名称</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500">合金价</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 text-right">单价</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 text-right">总价</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 text-center">状态</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 text-right w-[80px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsData?.items.map((r: any) => (
                <TableRow key={r.id} className={`transition-colors group border-b border-gray-50 ${r.isSuccessful === false ? "bg-gray-50/80 opacity-60" : "hover:bg-blue-50/40"}`}>
                  <TableCell className="py-3">
                    <div className="text-xs text-gray-500">{new Date(r.quotedAt).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-400">{new Date(r.quotedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-sm font-medium text-gray-900">{r.customerName}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-sm text-gray-800">{r.productName || r.ruleName || "-"}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.productCode || r.productModel || "-"}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    {r.ruleName === "按总价报" ? (
                      <div className="space-y-0.5">
                        <div className="text-xs text-gray-500">合金: ¥{Number(r.alloyPrice).toFixed(2)}</div>
                        <div className="text-xs text-blue-600">+加价: ¥{Number(r.fixedPrice).toFixed(2)}</div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="text-xs text-gray-600">合金: ¥{Number(r.alloyPrice).toFixed(2)}</div>
                        <div className="text-xs text-gray-400">公式: ¥{Number(r.alloyPrice).toFixed(2)} × {(r.pricePercent ?? 100) / 100} + ¥{Number(r.fixedPrice).toFixed(2)}</div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <span className="text-sm font-semibold text-green-700">¥{Number(r.unitPrice).toFixed(2)}</span>
                    <span className="text-xs text-gray-400">/{r.unit}</span>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <span className="text-sm font-medium text-gray-900">¥{Number(r.total).toFixed(2)}</span>
                    <div className="text-xs text-gray-400">{r.quantity}{r.unit}</div>
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <Badge className={`text-xs px-2 py-0.5 rounded-full ${r.isSuccessful === false ? "bg-gray-200 text-gray-500" : "bg-green-100 text-green-700"}`}>
                      {r.isSuccessful === false ? "未成交" : "成交"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="查看详情" onClick={() => setDetailRecord(r)}>
                        <Eye size={14} className="text-blue-400" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="修改价格" onClick={() => { setEditingRecordId(r.id); setEditMode("fixedPrice"); setEditFixedPrice(String(r.fixedPrice)); setEditTotal(String(r.total)); }}>
                        <Pencil size={14} className="text-amber-500" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { if (confirm("确定删除此报价记录？")) deleteRecord.mutate({ id: r.id }); }}>
                        <Trash2 size={14} className="text-red-400" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!recordsData || recordsData.items.length === 0) && (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-gray-300"><TrendingUp size={32} className="mx-auto mb-2" /><p className="text-sm">
                  {recordStatusFilter === "all" ? "暂无报价记录" : recordStatusFilter === "successful" ? "暂无成交报价记录" : "暂无未成交报价记录"}
                </p></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Price Dialog */}
      {editingRecordId !== null && (
        <Dialog open={true} onOpenChange={() => { setEditingRecordId(null); setEditFixedPrice(""); setEditTotal(""); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Pencil size={16} className="text-amber-500" />
                修改价格
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Mode switch */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditMode("fixedPrice")}
                  className={`py-2 px-3 rounded-md text-xs font-medium border transition-colors ${editMode === "fixedPrice" ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                >
                  修改加价
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode("total")}
                  className={`py-2 px-3 rounded-md text-xs font-medium border transition-colors ${editMode === "total" ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                >
                  修改总价
                </button>
              </div>

              {editMode === "fixedPrice" ? (
                <div>
                  <Label className="text-xs text-gray-500">新加价 (¥)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    step="0.01"
                    autoFocus
                    value={editFixedPrice}
                    onChange={e => setEditFixedPrice(e.target.value)}
                    placeholder="输入新加价"
                  />
                  <p className="text-xs text-gray-400 mt-1">系统将根据新加价重新计算单价和总价</p>
                </div>
              ) : (
                <div>
                  <Label className="text-xs text-gray-500">新总价 (¥)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    step="0.01"
                    autoFocus
                    value={editTotal}
                    onChange={e => setEditTotal(e.target.value)}
                    placeholder="输入新总价"
                  />
                  <p className="text-xs text-gray-400 mt-1">系统将根据新总价反向计算出加价</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditingRecordId(null); setEditFixedPrice(""); setEditTotal(""); }}>取消</Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (editMode === "fixedPrice") {
                      if (!editFixedPrice || isNaN(Number(editFixedPrice))) { toast.error("请输入有效的加价"); return; }
                      updateRecord.mutate({ id: editingRecordId, fixedPrice: Number(editFixedPrice) });
                    } else {
                      if (!editTotal || isNaN(Number(editTotal))) { toast.error("请输入有效的总价"); return; }
                      updateRecord.mutate({ id: editingRecordId, total: Number(editTotal) });
                    }
                    setEditingRecordId(null);
                    setEditFixedPrice("");
                    setEditTotal("");
                  }}
                  disabled={updateRecord.isPending}
                >
                  {updateRecord.isPending ? "保存中..." : "确认修改"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Record Detail Dialog */}
      {detailRecord && (
        <Dialog open={true} onOpenChange={() => setDetailRecord(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Eye size={16} className="text-blue-500" />
                报价记录详情
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs">客户</span><p className="font-medium">{detailRecord.customerName}</p></div>
                <div><span className="text-gray-400 text-xs">日期</span><p>{new Date(detailRecord.quotedAt).toLocaleString()}</p></div>
                <div><span className="text-gray-400 text-xs">产品名称</span><p className="font-medium">{detailRecord.productName || detailRecord.ruleName || "-"}</p></div>
                <div><span className="text-gray-400 text-xs">型号</span><p>{detailRecord.productModel || "-"}</p></div>
                <div>
                  <span className="text-gray-400 text-xs">报价状态</span>
                  <div className="mt-1">
                    <Badge className={`text-xs px-2.5 py-0.5 rounded-full ${detailRecord.isSuccessful === false ? "bg-gray-200 text-gray-500" : "bg-green-100 text-green-700"}`}>
                      {detailRecord.isSuccessful === false ? "未成交" : "成交"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-end">
                  {detailRecord.isSuccessful === false ? (
                    <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50 text-xs h-8" onClick={() => { updateRecordStatus.mutate({ id: detailRecord.id, isSuccessful: true }); setDetailRecord(null); }}>
                      <CheckCircle size={14} className="mr-1" />标记为成交
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-gray-500 border-gray-300 hover:bg-gray-50 text-xs h-8" onClick={() => { updateRecordStatus.mutate({ id: detailRecord.id, isSuccessful: false }); setDetailRecord(null); }}>
                      <XCircle size={14} className="mr-1" />标记为未成交
                    </Button>
                  )}
                </div>
              </div>
              {/* Price info */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-400 font-medium">价格信息</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {detailRecord.ruleName === "按总价报" ? (
                    <>
                      <div><span className="text-gray-400 text-xs">合金价</span><p>¥{Number(detailRecord.alloyPrice).toFixed(2)}</p></div>
                      <div><span className="text-gray-400 text-xs">加价</span><p className="font-medium text-blue-700">¥{Number(detailRecord.fixedPrice).toFixed(2)}</p></div>
                      <div><span className="text-gray-400 text-xs">数量</span><p>{detailRecord.quantity}{detailRecord.unit}</p></div>
                      <div><span className="text-gray-400 text-xs">总价</span><p className="font-medium text-blue-700">¥{Number(detailRecord.total).toFixed(2)}</p></div>
                    </>
                  ) : (
                    <>
                      <div><span className="text-gray-400 text-xs">合金价</span><p>¥{Number(detailRecord.alloyPrice).toFixed(2)}/{detailRecord.unit}</p></div>
                      <div><span className="text-gray-400 text-xs">系数</span><p>{(detailRecord.pricePercent ?? 100) / 100}</p></div>
                      <div><span className="text-gray-400 text-xs">加价</span><p className="font-medium text-amber-700">¥{Number(detailRecord.fixedPrice).toFixed(2)}</p></div>
                      <div><span className="text-gray-400 text-xs">数量</span><p>{detailRecord.quantity}{detailRecord.unit}</p></div>
                    </>
                  )}
                </div>
                {/* Formula */}
                <div className="bg-blue-50 rounded-md p-2 text-xs text-blue-700 font-mono space-y-1">
                  {detailRecord.ruleName === "按总价报" ? (
                    <>
                      <div>总价 ¥{Number(detailRecord.total).toFixed(2)} - 合金 ¥{Number(detailRecord.alloyPrice).toFixed(2)} × {detailRecord.quantity} = 加价 ¥{Number(detailRecord.fixedPrice).toFixed(2)}</div>
                      <div>总价 ¥{Number(detailRecord.total).toFixed(2)} ÷ {detailRecord.quantity} = 单价 ¥{Number(detailRecord.unitPrice).toFixed(2)}</div>
                    </>
                  ) : (
                    <>
                      <div>¥{Number(detailRecord.alloyPrice).toFixed(2)} × {(detailRecord.pricePercent ?? 100) / 100} + ¥{Number(detailRecord.fixedPrice).toFixed(2)} = ¥{Number(detailRecord.unitPrice).toFixed(2)}</div>
                      <div>¥{Number(detailRecord.unitPrice).toFixed(2)} × {detailRecord.quantity} = ¥{Number(detailRecord.total).toFixed(2)}</div>
                    </>
                  )}
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="text-xs text-gray-400">单价</span>
                  <span className="text-lg font-bold text-green-700">¥{Number(detailRecord.unitPrice).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">总价</span>
                  <span className="text-base font-semibold">¥{Number(detailRecord.total).toFixed(2)}</span>
                </div>
              </div>
              {/* Edit history */}
              {detailRecord.editHistory && detailRecord.editHistory.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-2">修改历史 ({detailRecord.editHistory.length}次)</p>
                  <div className="space-y-2">
                    {detailRecord.editHistory.map((h: any) => (
                      <div key={h.id} className={`rounded-md p-2.5 text-xs space-y-1 ${h.editType === "修改总价" ? "bg-blue-50" : "bg-amber-50"}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">{new Date(h.editedAt).toLocaleString()}</span>
                          <Badge className={`text-[10px] ${h.editType === "修改总价" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{h.editType || "修改"} · 第{h.id}次</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>加价: ¥{Number(h.oldFixedPrice).toFixed(2)} → <span className={`font-medium ${h.editType === "修改总价" ? "text-blue-700" : "text-amber-700"}`}>¥{Number(h.newFixedPrice).toFixed(2)}</span></span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-500">
                          <span>单价: ¥{Number(h.oldUnitPrice).toFixed(2)} → ¥{Number(h.newUnitPrice).toFixed(2)}</span>
                          <span>总价: ¥{Number(h.oldTotal).toFixed(2)} → ¥{Number(h.newTotal).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(!detailRecord.editHistory || detailRecord.editHistory.length === 0) && (
                <div className="text-center py-4 text-gray-400 text-xs">暂无修改记录</div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setDetailRecord(null)}>关闭</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
