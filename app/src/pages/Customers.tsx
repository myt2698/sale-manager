import { useState } from "react";
import { useMockTrpc } from "@/mock/useMockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Search, Plus, Eye, Pencil, Trash2, X, Building2,
  UserRound, Landmark, MapPin, FileText, CheckCircle, XCircle,
} from "lucide-react";
import { checklistLabels, docCheckLabels } from "@/mock/data";

const infoCheckGroups = [
  { title: "联系人信息", icon: UserRound, color: "text-green-500", items: checklistLabels.filter(i => i.group === "联系人信息") },
  { title: "财务信息", icon: Landmark, color: "text-indigo-500", items: checklistLabels.filter(i => i.group === "财务信息") },
  { title: "地址信息", icon: MapPin, color: "text-orange-500", items: checklistLabels.filter(i => i.group === "地址信息") },
];

function infoChecked(cl: Record<string, boolean> | undefined): number {
  if (!cl) return 0;
  return infoCheckGroups.reduce((sum, g) => sum + g.items.filter(i => !!cl[i.key]).length, 0);
}

function docChecked(cl: Record<string, boolean> | undefined): number {
  if (!cl) return 0;
  return (cl.riskDocChecked ? 1 : 0) + (cl.infoDocChecked ? 1 : 0);
}

function totalChecked(cl: Record<string, boolean> | undefined): number {
  return infoChecked(cl) + docChecked(cl);
}

const TOTAL_INFO = 8;
const TOTAL_DOC = 2;
const TOTAL_ALL = TOTAL_INFO + TOTAL_DOC;

export default function Customers() {
  const trpc = useMockTrpc();
  const { data, refetch } = trpc.customer.list.useQuery({ page: 1, pageSize: 20 });
  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => { toast.success("客户创建成功"); setShowForm(false); resetForm(); refetch(); },
  });
  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => { toast.success("客户更新成功"); setShowForm(false); setIsEditing(false); setEditId(null); refetch(); },
  });
  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => { toast.success("客户删除成功"); refetch(); },
  });

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const { data: detailData } = trpc.customer.getById.useQuery(
    { id: selectedCustomer! },
    { enabled: !!selectedCustomer }
  );

  const resetForm = () => {
    setCompanyName("");
    setNotes("");
    setChecklist({
      contactNameChecked: false, contactPhoneChecked: false,
      bankNameChecked: false, bankAccountChecked: false, bankAccountNameChecked: false,
      shippingNameChecked: false, shippingPhoneChecked: false, shippingAddressChecked: false,
      riskDocChecked: false, infoDocChecked: false,
    });
  };

  const openEditDialog = (customer: any) => {
    setEditId(customer.id);
    setIsEditing(true);
    setCompanyName(customer.companyName ?? "");
    setNotes(customer.notes ?? "");
    setChecklist(customer.checklist ?? {});
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) { toast.error("请输入公司名称"); return; }
    if (isEditing && editId) {
      updateMutation.mutate({ id: editId, data: { companyName, notes, checklist } });
    } else {
      const customerNo = `CUST-${String(Date.now()).slice(-6)}`;
      createMutation.mutate({
        customerNo, companyName, notes, checklist,
        contactName: "", contactPhone: "", bankName: "", bankAccount: "",
        bankAccountName: "", shippingName: "", shippingPhone: "", shippingAddress: "",
      });
    }
  };

  const toggleCheckItem = (key: string) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredItems = search
    ? (data?.items ?? []).filter((c: any) => c.companyName.toLowerCase().includes(search.toLowerCase()))
    : (data?.items ?? []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="搜索客户..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
        <Button onClick={() => { resetForm(); setIsEditing(false); setShowForm(true); }}>
          <Plus size={16} className="mr-1" />新建客户
        </Button>
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">公司名称</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">信息核对</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">文档核对</TableHead>
              <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((customer: any) => {
              const infoCount = infoChecked(customer.checklist);
              const docCount = docChecked(customer.checklist);
              const allCount = infoCount + docCount;
              return (
                <TableRow key={customer.id} className="hover:bg-blue-50/40 transition-colors cursor-default group border-b border-gray-50">
                  <TableCell className="py-3">
                    <div className="text-sm font-medium text-gray-900">{customer.companyName}</div>
                    {customer.notes && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[300px]">{customer.notes}</div>}
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <div className="inline-flex items-center gap-2">
                      {infoCount === TOTAL_INFO ? (
                        <Badge className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle size={10} className="mr-1" />已完成
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">
                          {infoCount}/{TOTAL_INFO}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      {docCheckLabels.map(d => (
                        <span key={d.key} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          customer.checklist?.[d.key] ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                        }`}>
                          {d.label.replace("客户", "")}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="查看" onClick={() => { setSelectedCustomer(customer.id); setOpenDetail(true); }}><Eye size={15} className="text-gray-500" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="编辑" onClick={() => openEditDialog(customer)}><Pencil size={15} className="text-gray-500" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="删除" onClick={() => { if (confirm("确定删除此客户？")) deleteMutation.mutate({ id: customer.id }); }}><Trash2 size={15} className="text-red-400" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-gray-300">
                    <Building2 size={40} />
                    <p className="text-sm">暂无客户数据</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 size={20} />
                  {isEditing ? "编辑客户" : "新建客户"}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setIsEditing(false); setEditId(null); resetForm(); }}>
                  <X size={18} />
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Company Name */}
                <div>
                  <Label className="text-xs text-gray-500">公司名称 *</Label>
                  <Input className="mt-1" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="输入公司全称" />
                </div>

                {/* Info Checklist */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <CheckCircle size={15} className="text-blue-500" /> 必要信息核对清单
                  </h4>
                  <p className="text-xs text-gray-400">请勾选已确认具备的信息项</p>

                  {infoCheckGroups.map(group => (
                    <div key={group.title} className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        <group.icon size={13} className={group.color} />
                        {group.title}
                      </div>
                      {group.items.map(item => (
                        <label key={item.key} className="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors bg-white">
                          <Checkbox checked={!!checklist[item.key]} onCheckedChange={() => toggleCheckItem(item.key)} />
                          <span className="text-sm flex-1">{item.label}</span>
                          {checklist[item.key] && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
                        </label>
                      ))}
                    </div>
                  ))}

                  <div className="flex items-center justify-between p-3 border rounded-lg bg-white">
                    <span className="text-sm font-medium">信息核对进度</span>
                    <span className="text-sm font-semibold text-gray-700">{infoChecked(checklist)} / {TOTAL_INFO}</span>
                  </div>
                </div>

                {/* Document Checklist */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <FileText size={15} className="text-purple-500" /> 文档核对
                  </h4>
                  <p className="text-xs text-gray-400">请确认以下文档是否已归档</p>

                  {docCheckLabels.map(item => (
                    <label key={item.key} className="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors bg-white">
                      <Checkbox checked={!!checklist[item.key]} onCheckedChange={() => toggleCheckItem(item.key)} />
                      <span className="text-sm flex-1">{item.label}</span>
                      {checklist[item.key] && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
                    </label>
                  ))}

                  <div className="flex items-center justify-between p-3 border rounded-lg bg-white">
                    <span className="text-sm font-medium">文档核对进度</span>
                    <span className="text-sm font-semibold text-gray-700">{docChecked(checklist)} / {TOTAL_DOC}</span>
                  </div>
                </div>

                {/* Overall Progress */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
                  <span className="text-sm font-semibold text-blue-800">总核对进度</span>
                  <span className="text-sm font-bold text-blue-800">
                    {totalChecked(checklist)} / {TOTAL_ALL}
                  </span>
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-xs text-gray-500">备注</Label>
                  <textarea className="w-full border rounded-md p-2.5 text-sm mt-1" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="补充说明..." />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); setIsEditing(false); setEditId(null); resetForm(); }}>取消</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {isEditing ? "保存修改" : "创建"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={openDetail} onOpenChange={setOpenDetail}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 size={18} />
              {detailData?.companyName}
            </DialogTitle>
          </DialogHeader>

          {detailData && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">客户编号</span>
                  <span className="text-sm font-medium">{detailData.customerNo}</span>
                </div>
                {detailData.notes && (
                  <div className="pt-1">
                    <span className="text-sm text-gray-500">备注</span>
                    <p className="text-sm mt-1 bg-yellow-50 rounded p-2">{detailData.notes}</p>
                  </div>
                )}
              </div>

              {/* Overall Status */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
                <span className="text-sm font-semibold text-blue-800">总核对进度</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-blue-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${((totalChecked(detailData.checklist)) / TOTAL_ALL) * 100}%` }} />
                  </div>
                  <span className="text-sm font-bold text-blue-800">{totalChecked(detailData.checklist)} / {TOTAL_ALL}</span>
                </div>
              </div>

              {/* Info Checklist Detail */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <CheckCircle size={15} className="text-blue-500" /> 必要信息核对
                </h4>
                {infoCheckGroups.map(group => (
                  <div key={group.title} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <group.icon size={13} className={group.color} />
                      {group.title}
                    </div>
                    {group.items.map(item => {
                      const isChecked = !!detailData.checklist?.[item.key];
                      return (
                        <div key={item.key} className="flex items-center gap-3 p-2.5 border rounded-lg bg-white">
                          {isChecked ? <CheckCircle size={16} className="text-green-500 flex-shrink-0" /> : <XCircle size={16} className="text-red-300 flex-shrink-0" />}
                          <span className={`text-sm flex-1 ${isChecked ? "text-gray-800" : "text-gray-400"}`}>{item.label}</span>
                          <span className={`text-xs ${isChecked ? "text-green-600" : "text-red-400"}`}>{isChecked ? "已具备" : "待补充"}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="flex items-center justify-between p-2.5 border rounded-lg bg-gray-50">
                  <span className="text-sm font-medium">信息核对</span>
                  {infoChecked(detailData.checklist) === TOTAL_INFO ? (
                    <Badge className="bg-green-100 text-green-700"><CheckCircle size={10} className="mr-1" />已完成</Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-700">{infoChecked(detailData.checklist)} / {TOTAL_INFO}</Badge>
                  )}
                </div>
              </div>

              {/* Document Checklist Detail */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <FileText size={15} className="text-purple-500" /> 文档核对
                </h4>
                {docCheckLabels.map(item => {
                  const isChecked = !!detailData.checklist?.[item.key];
                  return (
                    <div key={item.key} className="flex items-center gap-3 p-2.5 border rounded-lg bg-white">
                      {isChecked ? <CheckCircle size={16} className="text-green-500 flex-shrink-0" /> : <XCircle size={16} className="text-red-300 flex-shrink-0" />}
                      <span className={`text-sm flex-1 ${isChecked ? "text-gray-800" : "text-gray-400"}`}>{item.label}</span>
                      <span className={`text-xs ${isChecked ? "text-green-600" : "text-red-400"}`}>{isChecked ? "已归档" : "待归档"}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between p-2.5 border rounded-lg bg-gray-50">
                  <span className="text-sm font-medium">文档核对</span>
                  {docChecked(detailData.checklist) === TOTAL_DOC ? (
                    <Badge className="bg-green-100 text-green-700"><CheckCircle size={10} className="mr-1" />已完成</Badge>
                  ) : (
                    <Badge className="bg-yellow-100 text-yellow-700">{docChecked(detailData.checklist)} / {TOTAL_DOC}</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
