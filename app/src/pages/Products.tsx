import { useState } from "react";
import { useMockTrpc } from "@/mock/useMockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
// DialogFooter removed - using custom footer layout
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Search, Plus, Pencil, Trash2, Package, FileText, X, Tag, FolderOpen,
} from "lucide-react";

export default function Products() {
  const trpc = useMockTrpc();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);

  // Category management state
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: 0, name: "" });
  const [isEditingCategory, setIsEditingCategory] = useState(false);

  const { data, refetch } = trpc.product.list.useQuery({
    search: search || undefined,
  });

  // Fetch product categories
  const { data: categoryData, refetch: refetchCategories } = trpc.productCategory.list.useQuery({});

  const createMutation = trpc.product.create.useMutation({
    onSuccess: () => { toast.success("产品创建成功"); setShowForm(false); resetForm(); refetch(); },
  });
  const updateMutation = trpc.product.update.useMutation({
    onSuccess: () => { toast.success("产品更新成功"); setShowForm(false); setIsEditing(false); setEditId(null); refetch(); },
  });
  const deleteMutation = trpc.product.delete.useMutation({
    onSuccess: () => { toast.success("产品删除成功"); refetch(); },
  });

  const [formData, setFormData] = useState({
    productName: "", productCode: "", productModel: "", description: "", categoryId: 0, categoryName: "",
  });

  const resetForm = () => {
    setFormData({ productName: "", productCode: "", productModel: "", description: "", categoryId: 0, categoryName: "" });
  };

  // Category mutations
  const categoryCreateMutation = trpc.productCategory.create.useMutation({
    onSuccess: () => { toast.success("分类创建成功"); refetchCategories(); setCategoryForm({ id: 0, name: "" }); },
  });
  const categoryUpdateMutation = trpc.productCategory.update.useMutation({
    onSuccess: () => { toast.success("分类更新成功"); refetchCategories(); setIsEditingCategory(false); setCategoryForm({ id: 0, name: "" }); },
  });
  const categoryDeleteMutation = trpc.productCategory.delete.useMutation({
    onSuccess: (res: any) => { if (res?.error) { toast.error(res.error); } else { toast.success("分类删除成功"); refetchCategories(); } },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productName) { toast.error("产品名称必填"); return; }
    if (isEditing && editId) {
      updateMutation.mutate({ id: editId, data: { ...formData } });
    } else {
      createMutation.mutate({ ...formData });
    }
  };

  const openEditDialog = (product: any) => {
    setEditId(product.id);
    setIsEditing(true);
    setFormData({
      productName: product.productName,
      productCode: product.productCode ?? "",
      productModel: product.productModel ?? "",
      description: product.description ?? "",
      categoryId: product.categoryId ?? 0,
      categoryName: product.categoryName ?? "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setIsEditing(false);
    setEditId(null);
    resetForm();
  };

  const handleCategorySelect = (categoryId: number, categoryName: string) => {
    setFormData({ ...formData, categoryId, categoryName });
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) { toast.error("分类名称必填"); return; }
    if (isEditingCategory && categoryForm.id) {
      categoryUpdateMutation.mutate({ id: categoryForm.id, name: categoryForm.name.trim() });
    } else {
      categoryCreateMutation.mutate({ name: categoryForm.name.trim() });
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="搜索产品名称/料号/型号..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setShowCategoryDialog(true); setCategoryForm({ id: 0, name: "" }); setIsEditingCategory(false); }}>
              <FolderOpen size={16} className="mr-1" />
              分类管理
            </Button>
            <Button onClick={() => { resetForm(); setIsEditing(false); setShowForm(true); }}>
              <Plus size={18} className="mr-1" />
              新建产品
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">产品名称</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">分类</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">料号</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">型号</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-[120px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((product: any) => (
                <TableRow key={product.id} className="hover:bg-blue-50/40 transition-colors cursor-default group border-b border-gray-50">
                  <TableCell className="py-3">
                    <span className="text-sm font-semibold text-gray-900">{product.productName}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    {product.categoryName ? (
                      <span className="inline-flex items-center bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded font-medium">{product.categoryName}</span>
                    ) : (
                      <span className="text-xs text-gray-300">未分类</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    {product.productCode ? (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded font-mono">{product.productCode}</span>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    {product.productModel ? (
                      <span className="inline-flex items-center bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded font-medium">{product.productModel}</span>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <div className="flex justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="详情" onClick={() => { setDetailProduct(product); setOpenDetail(true); }}><FileText size={15} className="text-gray-500" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="编辑" onClick={() => openEditDialog(product)}><Pencil size={15} className="text-gray-500" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="删除" onClick={() => { if (confirm("确定删除此产品？")) deleteMutation.mutate({ id: product.id }); }}><Trash2 size={15} className="text-red-400" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!data || data.items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <Package size={40} />
                      <p className="text-sm">暂无产品数据</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inline Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Package size={20} />
                  {isEditing ? "编辑产品" : "新建产品"}
                </h3>
                <Button variant="ghost" size="sm" onClick={closeForm}><X size={18} /></Button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* ===== 基本信息 ===== */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Package size={15} className="text-blue-500" /> 基本信息
                  </h4>
                  <div>
                    <Label className="text-xs text-gray-500">产品名称 *</Label>
                    <Input
                      className="mt-1"
                      value={formData.productName}
                      onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                      placeholder="锡膏"
                    />
                  </div>
                </div>

                {/* ===== 产品规格 ===== */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Tag size={15} className="text-indigo-500" /> 产品规格
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">产品分类</Label>
                      <select
                        className="w-full border rounded-md px-2.5 py-2 text-sm mt-1 bg-white"
                        value={formData.categoryId}
                        onChange={(e) => {
                          const catId = Number(e.target.value);
                          const cat = categoryData?.items?.find((c: any) => c.id === catId);
                          handleCategorySelect(catId, cat?.name ?? "");
                        }}
                      >
                        <option value={0}>选择分类</option>
                        {categoryData?.items?.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">产品料号</Label>
                      <Input
                        className="mt-1"
                        value={formData.productCode}
                        onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                        placeholder="PASTEOT-808903-JAR"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">产品型号</Label>
                      <Input
                        className="mt-1"
                        value={formData.productModel}
                        onChange={(e) => setFormData({ ...formData, productModel: e.target.value })}
                        placeholder="SN96.5AG3.0CU0.5/T4/Y89/88.35%"
                      />
                    </div>
                  </div>
                </div>

                {/* ===== 产品描述 ===== */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <FileText size={15} className="text-green-500" /> 产品描述
                  </h4>
                  <div>
                    <Label className="text-xs text-gray-500">描述</Label>
                    <textarea
                      className="w-full border rounded-md p-2.5 text-sm mt-1"
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="输入产品描述、技术参数等补充信息..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={closeForm}>取消</Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package size={18} /> 产品详情
            </DialogTitle>
          </DialogHeader>
          {detailProduct && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400">产品名称:</span> <span className="font-medium">{detailProduct.productName}</span></div>
                <div><span className="text-gray-400">分类:</span> {detailProduct.categoryName ? <span className="inline-flex items-center bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded font-medium">{detailProduct.categoryName}</span> : "-"}</div>
                <div><span className="text-gray-400">料号:</span> {detailProduct.productCode || "-"}</div>
                <div><span className="text-gray-400">型号:</span> {detailProduct.productModel || "-"}</div>
              </div>
              {detailProduct.description && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <p className="text-xs text-gray-400 mb-1">描述</p>
                  <p className="text-sm">{detailProduct.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen size={18} /> 分类管理
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Create/Edit Category Form */}
            <form onSubmit={handleCategorySubmit} className="flex gap-2">
              <Input
                placeholder={isEditingCategory ? "编辑分类名称" : "新建分类名称"}
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                className="flex-1"
              />
              {isEditingCategory ? (
                <>
                  <Button type="submit" size="sm" variant="default">保存</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setIsEditingCategory(false); setCategoryForm({ id: 0, name: "" }); }}>取消</Button>
                </>
              ) : (
                <Button type="submit" size="sm" variant="default"><Plus size={16} className="mr-1" />添加</Button>
              )}
            </form>

            {/* Category List */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs text-gray-500">分类名称</TableHead>
                    <TableHead className="text-xs text-gray-500 text-right w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryData?.items?.length === 0 && (
                    <TableRow><TableCell colSpan={2} className="text-center py-8 text-gray-400 text-sm">暂无分类</TableCell></TableRow>
                  )}
                  {categoryData?.items?.map((cat: any) => (
                    <TableRow key={cat.id} className="border-b border-gray-50">
                      <TableCell className="py-2">
                        <span className="inline-flex items-center bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded font-medium">{cat.name}</span>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="编辑" onClick={() => { setCategoryForm({ id: cat.id, name: cat.name }); setIsEditingCategory(true); }}><Pencil size={14} className="text-gray-500" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="删除" onClick={() => { if (confirm("确定删除此分类？")) categoryDeleteMutation.mutate({ id: cat.id }); }}><Trash2 size={14} className="text-red-400" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
