import { useState } from "react";
import { useMockTrpc } from "@/mock/useMockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "react-router";
import { Search, Plus, Pencil, Trash2, X, FileText, Calculator, TrendingUp, Package, ChevronRight } from "lucide-react";
import type { AlloyFormula } from "@/mock/data";

const availableMetals = ["锡", "银", "铜", "铅", "铋", "锑", "镍", "锌", "铟"];

interface FormulaItem {
  metal: string;
  percent: string;
}

export default function QuotationRules() {
  const [search, setSearch] = useState("");
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productPickerSearch, setProductPickerSearch] = useState("");

  const [ruleForm, setRuleForm] = useState({
    customerId: 0, productId: 0, ruleName: "", productName: "", productCode: "", productModel: "", productType: "", pricePercent: "100", fixedPrice: "", unit: "kg", notes: "",
  });
  const [formulaItems, setFormulaItems] = useState<FormulaItem[]>([{ metal: "锡", percent: "" }]);

  const [quoteCustomerId, setQuoteCustomerId] = useState(0);
  const [quoteRuleId, setQuoteRuleId] = useState(-1);
  const [alloyPrice, setAlloyPrice] = useState("");
  const [quoteQty, setQuoteQty] = useState("1.00");
  const [quoteTotalPrice, setQuoteTotalPrice] = useState("");
  const [quoteProductId, setQuoteProductId] = useState(0);
  const [quoteResult, setQuoteResult] = useState<{ unitPrice: number; total: number } | null>(null);

  const trpc = useMockTrpc();
  const { data: rulesData, refetch } = trpc.quotationRule.list.useQuery({ search: search || undefined });
  const { data: customersData } = trpc.customer.list.useQuery({ pageSize: 100 });
  const { data: productsData } = trpc.product.list.useQuery({});

  const createRule = trpc.quotationRule.create.useMutation({
    onSuccess: () => { toast.success("规则创建成功"); closeRuleForm(); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const updateRule = trpc.quotationRule.update.useMutation({
    onSuccess: () => { toast.success("规则更新成功"); closeRuleForm(); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteRule = trpc.quotationRule.delete.useMutation({
    onSuccess: () => { toast.success("规则删除成功"); refetch(); },
  });

  const createRecord = trpc.quotationRecord.create.useMutation({
    onSuccess: () => { toast.success("报价记录已保存"); },
    onError: (err: any) => toast.error(err.message),
  });



  const closeRuleForm = () => {
    setShowRuleForm(false); setEditingRule(null);
    setSelectedProductId(""); setShowProductPicker(false); setProductPickerSearch("");
    setRuleForm({ customerId: 0, productId: 0, ruleName: "", productName: "", productCode: "", productModel: "", productType: "", pricePercent: "100", fixedPrice: "", unit: "kg", notes: "" });
    setFormulaItems([{ metal: "锡", percent: "" }]);
  };

  const openEditRule = (rule: any) => {
    setEditingRule(rule);
    const pid = rule.productId ? rule.productId.toString() : "";
    setSelectedProductId(pid);
    setRuleForm({
      customerId: rule.customerId, productId: rule.productId ?? 0, ruleName: rule.ruleName, productName: rule.productName ?? "", productCode: rule.productCode ?? "", productModel: rule.productModel ?? "", productType: rule.productType,
      pricePercent: String(rule.pricePercent ?? 100), fixedPrice: String(rule.fixedPrice), unit: rule.unit, notes: rule.notes || "",
    });
    setFormulaItems((rule.alloyFormula ?? []).map((f: AlloyFormula) => ({ metal: f.metal, percent: String(f.percent) })));
    setShowRuleForm(true);
  };

  const addFormulaItem = () => setFormulaItems([...formulaItems, { metal: availableMetals[0], percent: "" }]);
  const removeFormulaItem = (idx: number) => {
    if (formulaItems.length <= 1) return;
    setFormulaItems(formulaItems.filter((_, i) => i !== idx));
  };
  const updateFormulaItem = (idx: number, field: keyof FormulaItem, value: string) => {
    const next = [...formulaItems];
    next[idx] = { ...next[idx], [field]: value };
    setFormulaItems(next);
  };

  const handleRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.customerId) { toast.error("请选择客户"); return; }
    if (!ruleForm.productId) { toast.error("请选择产品"); return; }
    if (!ruleForm.pricePercent || isNaN(Number(ruleForm.pricePercent))) { toast.error("请输入金属价系数"); return; }
    const pct = Number(ruleForm.pricePercent);
    if (pct <= 0 || pct > 200) { toast.error("系数应在 0~200 之间"); return; }
    if (!ruleForm.fixedPrice || isNaN(Number(ruleForm.fixedPrice))) { toast.error("请输入加价"); return; }

    const payload = { customerId: ruleForm.customerId, productId: ruleForm.productId, ruleName: ruleForm.ruleName, productName: ruleForm.productName, productCode: ruleForm.productCode, productModel: ruleForm.productModel, productType: ruleForm.productType, alloyFormula: [] as AlloyFormula[], pricePercent: Number(ruleForm.pricePercent), fixedPrice: Number(ruleForm.fixedPrice), unit: ruleForm.unit, notes: ruleForm.notes };
    if (editingRule) updateRule.mutate({ id: editingRule.id, ...payload });
    else createRule.mutate(payload);
  };

  const selectedRules = rulesData?.items.filter((r: any) => r.customerId === quoteCustomerId || r.id === 0) ?? [];
  const selectedRule = selectedRules.find((r: any) => r.id === quoteRuleId);
  const isTotalPriceMode = selectedRule?.id === 0 && quoteRuleId === 0;
  const quoteProduct = (productsData?.items ?? []).find((p: any) => p.id === quoteProductId);

  const handleCalculate = () => {
    if (!selectedRule) return;
    if (isTotalPriceMode) {
      if (!quoteProductId) { toast.error("请选择产品"); return; }
      const total = Number(quoteTotalPrice);
      if (isNaN(total) || total <= 0) { toast.error("请输入总价"); return; }
      const qty = Number(quoteQty) || 1;
      const unitPrice = Math.round(total / qty * 100) / 100;
      setQuoteResult({ unitPrice, total });
      toast.success("计算完成，请保存报价记录");
    } else {
      const price = Number(alloyPrice);
      if (isNaN(price) || price <= 0) { toast.error("请输入合金价格"); return; }
      const pct = (selectedRule.pricePercent ?? 100) / 100;
      const fixed = Number(selectedRule.fixedPrice);
      const unitPrice = Math.round((price * pct + fixed) * 100) / 100;
      const qty = Number(quoteQty) || 1;
      const total = Math.round(unitPrice * qty * 100) / 100;
      setQuoteResult({ unitPrice, total });
      toast.success("计算完成，请保存报价记录");
    }
  };

  const handleSaveQuote = () => {
    if (!quoteResult || !selectedRule) return;
    if (isTotalPriceMode && !quoteProductId) { toast.error("请选择产品"); return; }
    createRecord.mutate({
      ruleId: selectedRule.id,
      customerId: quoteCustomerId,
      alloyPrice: isTotalPriceMode ? 0 : Number(alloyPrice),
      fixedPrice: isTotalPriceMode ? 0 : Number(selectedRule.fixedPrice),
      pricePercent: selectedRule.pricePercent ?? 100,
      unitPrice: quoteResult.unitPrice,
      quantity: Number(quoteQty),
      total: quoteResult.total,
      productName: isTotalPriceMode ? quoteProduct?.productName : undefined,
      productCode: isTotalPriceMode ? quoteProduct?.productCode : undefined,
      productModel: isTotalPriceMode ? quoteProduct?.productModel : undefined,
    });
    // Mock mutation is synchronous, close form immediately
    setShowQuoteForm(false);
    setQuoteResult(null);
    setAlloyPrice("");
    setQuoteQty("1.00");
    setQuoteTotalPrice("");
    setQuoteProductId(0);
    setQuoteRuleId(-1);
  };

  return (
    <div className="space-y-4 pb-8">
      <Card>
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="text-gray-700 font-medium flex items-center gap-1"><FileText size={14} />报价规则</span>
          <ChevronRight size={14} />
          <Link to="/quotation-records" className="hover:text-blue-600 transition-colors flex items-center gap-1">
            <TrendingUp size={14} />报价记录
          </Link>
        </div>
      </div>

        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input placeholder="搜索客户或规则..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowQuoteForm(true)}><Calculator size={16} className="mr-1" />快速报价</Button>
            <Button size="sm" onClick={() => { closeRuleForm(); setShowRuleForm(true); }}><Plus size={16} className="mr-1" />新建规则</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText size={18} />报价规则列表</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-500">客户</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500">产品名称</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500">型号</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 text-right">加价</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 text-right w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rulesData?.items.filter((rule: any) => rule.id !== 0).map((rule: any) => (
                <TableRow key={rule.id} className="hover:bg-blue-50/40 transition-colors group border-b border-gray-50">
                  <TableCell className="py-3"><div className="text-sm font-medium text-gray-900">{rule.customerName}</div></TableCell>
                  <TableCell className="py-3">
                    <div className="text-sm text-gray-800">{rule.productName || rule.ruleName || "-"}</div>
                    {rule.productCode && <div className="text-xs text-gray-400 mt-0.5">{rule.productCode}</div>}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-sm text-gray-700">{rule.productModel || "-"}</div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <span className="text-sm font-medium text-gray-900">×{(rule.pricePercent ?? 100)}% + ¥{Number(rule.fixedPrice).toFixed(2)}</span>
                    <span className="text-xs text-gray-400">/{rule.unit}</span>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditRule(rule)}><Pencil size={15} className="text-gray-500" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { if (confirm("确定删除？")) deleteRule.mutate({ id: rule.id }); }}><Trash2 size={15} className="text-red-400" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!rulesData || rulesData.items.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center py-16 text-gray-300"><FileText size={40} className="mx-auto mb-2" /><p className="text-sm">暂无报价规则</p></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>


      {/* Rule Form */}
      {showRuleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 space-y-4">
              <div className="sticky top-0 z-10 flex justify-end -mx-2 -mt-2 mb-2">
                <button onClick={closeRuleForm} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F5F5] text-gray-500 hover:bg-[#E5E5E5]"><X size={15} strokeWidth={2.5} /></button>
              </div>
              <h3 className="text-lg font-semibold flex items-center gap-2 -mt-4"><FileText size={20} />{editingRule ? "编辑报价规则" : "新建报价规则"}</h3>
              <form onSubmit={handleRuleSubmit} className="space-y-4">
                {/* 基础信息 */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Package size={14} className="text-blue-500" />基础信息
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs text-gray-500">客户 *</Label>
                      <Select value={ruleForm.customerId ? String(ruleForm.customerId) : ""} onValueChange={v => setRuleForm({ ...ruleForm, customerId: Number(v) })}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="请选择客户" /></SelectTrigger>
                        <SelectContent>{customersData?.items.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* 产品信息 - 选择模式 */}
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">产品信息 *</Label>
                    <div className="flex gap-2 items-center">
                      <div className={`flex-1 min-h-[36px] border rounded-md px-3 text-sm flex items-center ${selectedProductId ? "bg-indigo-50 border-indigo-200 text-indigo-800" : "bg-white border-gray-200 text-gray-400"}`}>
                        {selectedProductId
                          ? (() => {
                              const p = productsData?.items?.find((x: any) => x.id.toString() === selectedProductId);
                              return p ? <span><span className="font-medium">{p.productName}</span> <span className="text-xs text-gray-400 ml-1">{p.productModel} | {p.productCode}</span></span> : "请选择产品";
                            })()
                          : "尚未选择产品，请点击右侧按钮"}
                      </div>
                      <Button type="button" size="sm" variant={selectedProductId ? "outline" : "default"} onClick={() => { setShowProductPicker(true); setProductPickerSearch(""); }}>{selectedProductId ? "更换" : "选择"}</Button>
                    </div>
                    {/* 选中产品后显示三列：名称/料号/型号 */}
                    {selectedProductId && (
                      <div className="grid grid-cols-3 gap-3 pt-1">
                        <div>
                          <Label className="text-xs text-gray-500">产品名称</Label>
                          <Input className="mt-1 bg-gray-50 text-sm" readOnly value={ruleForm.productName} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">料号</Label>
                          <Input className="mt-1 bg-gray-50 text-sm" readOnly value={ruleForm.productCode} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">型号</Label>
                          <Input className="mt-1 bg-gray-50 text-sm" readOnly value={ruleForm.productModel} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 计价参数 */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Calculator size={14} className="text-green-500" />计价参数
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">金属价系数 *</Label>
                      <Input className="mt-1" type="number" step="0.01" min="0" max="200" placeholder="如：0.95" value={ruleForm.pricePercent} onChange={e => setRuleForm({ ...ruleForm, pricePercent: e.target.value })} />
                      <p className="text-xs text-gray-400 mt-1">合金价 × 此系数</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">加价 (¥) *</Label>
                      <Input className="mt-1" type="number" step="0.01" placeholder="如：50.00" value={ruleForm.fixedPrice} onChange={e => setRuleForm({ ...ruleForm, fixedPrice: e.target.value })} />
                      <p className="text-xs text-gray-400 mt-1">每公斤固定加收</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">计价单位</Label>
                      <Select value={ruleForm.unit} onValueChange={v => setRuleForm({ ...ruleForm, unit: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="g">g</SelectItem><SelectItem value="瓶">瓶</SelectItem><SelectItem value="桶">桶</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-md p-2.5 text-xs text-blue-700">
                    报价公式：合金价 × {(Number(ruleForm.pricePercent || 100) / 100)} + ¥{ruleForm.fixedPrice || "0"} = 最终单价
                  </div>
                </div>

                {/* 备注 */}
                <div className="border rounded-lg p-4">
                  <Label className="text-xs text-gray-500">备注</Label>
                  <textarea className="w-full border rounded-md p-2 text-sm mt-1" rows={2} placeholder="补充说明..." value={ruleForm.notes} onChange={e => setRuleForm({ ...ruleForm, notes: e.target.value })} />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={closeRuleForm}>取消</Button>
                  <Button type="submit" disabled={createRule.isPending || updateRule.isPending}>{editingRule ? "保存修改" : "创建规则"}</Button>
                </div>
              </form>

              {/* Product Picker Modal */}
              {showProductPicker && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-lg shadow-lg w-full max-w-md m-4 flex flex-col" style={{ maxHeight: "80vh" }}>
                    <div className="p-4 border-b flex items-center justify-between">
                      <h4 className="font-semibold">选择产品</h4>
                      <Button variant="ghost" size="sm" onClick={() => setShowProductPicker(false)}><X size={16} /></Button>
                    </div>
                    <div className="p-4">
                      <input
                        type="text"
                        className="w-full h-9 border border-gray-300 rounded-md px-3 text-sm bg-white"
                        placeholder="搜索产品名称、型号或料号..."
                        value={productPickerSearch}
                        onChange={e => setProductPickerSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 pb-4">
                      {(productsData?.items ?? [])
                        .filter((p: any) => {
                          if (!productPickerSearch) return true;
                          const s = productPickerSearch.toLowerCase();
                          return p.productName.toLowerCase().includes(s) || p.productCode.toLowerCase().includes(s) || p.productModel.toLowerCase().includes(s);
                        })
                        .map((p: any) => (
                          <div key={p.id}
                            className={`px-4 py-3 border-b cursor-pointer hover:bg-blue-50 ${selectedProductId === p.id.toString() ? "bg-blue-50 text-blue-700" : ""}`}
                            onClick={() => {
                              setSelectedProductId(p.id.toString());
                              setRuleForm(prev => ({
                                ...prev,
                                productId: p.id,
                                productName: p.productName,
                                productCode: p.productCode ?? "",
                                productModel: p.productModel ?? "",
                                ruleName: p.productCode ?? "",
                              }));
                              setShowProductPicker(false);
                            }}>
                            <div className="font-medium text-sm">{p.productName}</div>
                            <div className="text-xs text-gray-400">{p.productModel} | {p.productCode}</div>
                          </div>
                        ))}
                      {(productsData?.items ?? []).filter((p: any) => {
                        if (!productPickerSearch) return true;
                        const s = productPickerSearch.toLowerCase();
                        return p.productName.toLowerCase().includes(s) || p.productCode.toLowerCase().includes(s) || p.productModel.toLowerCase().includes(s);
                      }).length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">无匹配产品</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Quote Form */}
      {showQuoteForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 space-y-4">
              <div className="sticky top-0 z-10 flex justify-end -mx-2 -mt-2 mb-2">
                <button onClick={() => { setShowQuoteForm(false); setQuoteResult(null); setAlloyPrice(""); setQuoteTotalPrice(""); setQuoteProductId(0); setQuoteRuleId(-1); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F5F5] text-gray-500 hover:bg-[#E5E5E5]"><X size={15} strokeWidth={2.5} /></button>
              </div>
              <h3 className="text-lg font-semibold flex items-center gap-2 -mt-4"><Calculator size={20} />快速报价</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-gray-500">选择客户</Label>
                  <Select value={quoteCustomerId ? String(quoteCustomerId) : ""} onValueChange={v => { setQuoteCustomerId(Number(v)); setQuoteRuleId(-1); setQuoteResult(null); setAlloyPrice(""); }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="选择客户" /></SelectTrigger>
                    <SelectContent>{customersData?.items.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {quoteCustomerId > 0 && (
                  <div>
                    <Label className="text-xs text-gray-500">选择报价规则</Label>
                    <Select value={quoteRuleId >= 0 ? String(quoteRuleId) : ""} onValueChange={v => { setQuoteRuleId(Number(v)); setQuoteResult(null); setAlloyPrice(""); }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="选择规则" /></SelectTrigger>
                      <SelectContent>
                        {selectedRules.length === 0 && <SelectItem value="0" disabled>该客户暂无报价规则</SelectItem>}
                        {selectedRules.map((r: any) => (
                          <SelectItem key={r.id} value={String(r.id)}>{r.ruleName} {r.productModel ? `(${r.productModel})` : ""} ×{((r.pricePercent ?? 100) / 100)} + ¥{r.fixedPrice}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedRule && (
                  <>
                    {isTotalPriceMode ? (
                      /* 按总价报模式 */
                      <>
                        <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-700 text-xs">按总价报</Badge>
                            <p className="text-xs text-blue-600">直接输入总价，不计算合金价</p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">产品 *</Label>
                          <Select value={quoteProductId ? String(quoteProductId) : ""} onValueChange={v => { setQuoteProductId(Number(v)); setQuoteResult(null); }}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="选择产品" /></SelectTrigger>
                            <SelectContent>{productsData?.items.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.productName} | {p.productCode}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">合金价格 (¥/kg)</Label>
                          <Input className="mt-1" type="number" step="0.01" placeholder="输入合金价格，用于计算加价" value={alloyPrice} onChange={e => setAlloyPrice(e.target.value)} />
                          <p className="text-xs text-gray-400 mt-1">加价 = 总价 - 合金价 × 数量</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">总价 (¥) *</Label>
                          <Input className="mt-1" type="number" step="0.01" placeholder="输入总价金额" value={quoteTotalPrice} onChange={e => setQuoteTotalPrice(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">数量 (kg)</Label>
                          <Input className="mt-1" type="number" step="0.01" value={quoteQty} onChange={e => setQuoteQty(e.target.value)} />
                        </div>
                        <Button
                          className="w-full"
                          variant="secondary"
                          onClick={() => {
                            if (!quoteProductId) { toast.error("请选择产品"); return; }
                            const total = Number(quoteTotalPrice);
                            if (isNaN(total) || total <= 0) { toast.error("请输入总价"); return; }
                            const qty = Number(quoteQty) || 1;
                            const unitPrice = Math.round(total / qty * 100) / 100;
                            const alloyP = alloyPrice ? Number(alloyPrice) : 0;
                            const markup = Math.round((total - alloyP * qty) * 100) / 100;
                            createRecord.mutate({
                              ruleId: selectedRule.id,
                              customerId: quoteCustomerId,
                              alloyPrice: alloyP,
                              fixedPrice: markup,
                              pricePercent: 100,
                              unitPrice,
                              quantity: qty,
                              total,
                              productName: quoteProduct?.productName,
                              productCode: quoteProduct?.productCode,
                              productModel: quoteProduct?.productModel,
                            });
                            setShowQuoteForm(false);
                            setQuoteTotalPrice("");
                            setQuoteProductId(0);
                            setAlloyPrice("");
                            setQuoteRuleId(-1);
                          }}
                          disabled={createRecord.isPending}
                        >
                          <FileText size={16} className="mr-1" />
                          {createRecord.isPending ? "保存中..." : "保存报价记录"}
                        </Button>
                      </>
                    ) : (
                      /* 正常模式 */
                      <>
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-400">产品:</p>
                            <p className="text-sm font-medium">{selectedRule.productName || "-"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-400">型号:</p>
                            <p className="text-sm font-medium">{selectedRule.productModel || "-"}</p>
                          </div>
                          <p className="text-xs text-gray-500">公式: 合金价 × {((selectedRule.pricePercent ?? 100) / 100)} + ¥{Number(selectedRule.fixedPrice).toFixed(2)} = 单价</p>
                        </div>

                        <div>
                          <Label className="text-xs text-gray-500">当日合金价格 (¥/{selectedRule.unit}) *</Label>
                          <Input className="mt-1" type="number" step="0.01" placeholder="输入合金整体价格" value={alloyPrice} onChange={e => setAlloyPrice(e.target.value)} />
                        </div>

                        <div>
                          <Label className="text-xs text-gray-500">数量 ({selectedRule.unit})</Label>
                          <Input className="mt-1" type="number" step="0.01" value={quoteQty} onChange={e => setQuoteQty(e.target.value)} />
                        </div>

                        <Button className="w-full" onClick={handleCalculate} disabled={!selectedRule}>计算价格</Button>

                        {quoteResult && (
                          <div className="bg-green-50 rounded-lg p-4 space-y-2">
                            <p className="text-xs text-gray-500">计算结果</p>
                            <div className="text-xs text-gray-600">合金价 ¥{Number(alloyPrice).toFixed(2)} × {((selectedRule.pricePercent ?? 100) / 100)} + 加价 ¥{Number(selectedRule.fixedPrice).toFixed(2)}</div>
                            <div className="flex justify-between items-center border-t pt-2">
                              <span className="text-sm text-gray-600">单价</span>
                              <span className="text-2xl font-bold text-green-700">¥{quoteResult.unitPrice.toFixed(2)}<span className="text-xs text-gray-400 font-normal">/{selectedRule.unit}</span></span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">总价 ({quoteQty}{selectedRule.unit})</span>
                              <span className="text-lg font-semibold text-gray-900">¥{quoteResult.total.toFixed(2)}</span>
                            </div>
                            <Button className="w-full mt-2" variant="secondary" onClick={handleSaveQuote} disabled={createRecord.isPending}>
                              <FileText size={16} className="mr-1" />{createRecord.isPending ? "保存中..." : "保存报价记录"}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
