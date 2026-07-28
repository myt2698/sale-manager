import { useState, useMemo, useEffect } from "react";
import { useMockTrpc } from "@/mock/useMockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Check, FileCode, RotateCcw, X } from "lucide-react";

const standardFileTypes = ["报价单", "采购订单", "送货单", "对账单", "发票"];
const customerOnlyFileTypes = ["客户风险评估表", "客户信息备案表", "客户样品申请表", "开票资料"];
const allFileTypes = [...standardFileTypes, ...customerOnlyFileTypes];

// Check if a file type only needs customer name (no product/quantity)
function isCustomerOnlyType(type: string): boolean {
  return customerOnlyFileTypes.includes(type);
}

const LS_HISTORY_KEY = "filename-generator-history";

interface HistoryRecord {
  filename: string;
  createdAt: string;
}

function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(records: HistoryRecord[]) {
  localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(records.slice(0, 50)));
}

export default function FilenameGenerator() {
  const trpc = useMockTrpc();
  const { data: customersData } = trpc.customer.list.useQuery({ pageSize: 1000 });
  const { data: productsData } = trpc.product.list.useQuery({});

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [fileType, setFileType] = useState(allFileTypes[0]);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [copied, setCopied] = useState(false);
  const customerOnly = isCustomerOnlyType(fileType);

  const customers = customersData?.items ?? [];
  const products = productsData?.items ?? [];

  const selectedCustomer = customers.find((c: any) => c.id === customerId);
  const customerName = selectedCustomer?.companyName ?? "";

  const generatedFilename = useMemo(() => {
    if (!date || !fileType || !customerName) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    // Customer-only types: 年-月-日_文件类型_客户名称
    if (customerOnly) {
      return `${year}-${month}-${day}_${fileType}_${customerName}`;
    }
    // Standard types: 年-月-日_文件类型_客户名_产品名称_数量kg
    if (!productName || !quantity) return "";
    return `${year}-${month}-${day}_${fileType}_${customerName}_${productName}_${quantity}kg`;
  }, [date, fileType, customerName, productName, quantity, customerOnly]);

  const handleCopy = async () => {
    if (!generatedFilename) return;

    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(generatedFilename);
        onCopySuccess();
        return;
      } catch {
        // fallback to execCommand
      }
    }

    // Fallback: use document.execCommand("copy")
    try {
      const textArea = document.createElement("textarea");
      textArea.value = generatedFilename;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (success) {
        onCopySuccess();
        return;
      }
    } catch {
      // final fallback
    }

    // Final fallback: auto-select text for manual copy
    toast.error("自动复制不可用，请手动复制上方文件名");
  };

  const onCopySuccess = () => {
    setCopied(true);
    const history = loadHistory();
    history.unshift({ filename: generatedFilename, createdAt: new Date().toISOString() });
    saveHistory(history);
    toast.success("文件名已复制到剪贴板");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setFileType(allFileTypes[0]);
    setCustomerId("");
    setProductName("");
    setQuantity("");
    setCopied(false);
  };

  const isComplete = date && fileType && customerName && (customerOnly || (productName && quantity));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <FileCode size={22} className="text-blue-500" />
        <h2 className="text-xl font-bold">存档文件名生成器</h2>
      </div>
      <p className="text-sm text-gray-500 -mt-4">
        快速生成规范的销售存档文件名，一键复制用于邮件或微信文件保存
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileCode size={16} className="text-blue-500" />
            填写文件信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 日期 */}
          <div>
            <Label className="text-xs text-gray-500">日期 *</Label>
            <Input
              className="mt-1"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* 文件类型 */}
          <div>
            <Label className="text-xs text-gray-500">文件类型 *</Label>
            <div className="space-y-2 mt-1">
              <div className="grid grid-cols-5 gap-2">
                {standardFileTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFileType(type)}
                    className={`px-2 py-2 rounded-md text-xs font-medium border transition-colors ${
                      fileType === type
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {customerOnlyFileTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFileType(type)}
                    className={`px-2 py-2 rounded-md text-xs font-medium border transition-colors ${
                      fileType === type
                        ? "bg-amber-50 border-amber-300 text-amber-700"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 客户 */}
          <div>
            <Label className="text-xs text-gray-500">客户 *</Label>
            <select
              className="w-full mt-1 h-9 border rounded-md px-3 text-sm bg-white"
              value={customerId}
              onChange={(e) => setCustomerId(Number(e.target.value) || "")}
            >
              <option value="">请选择客户</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* 产品名称 + 数量：仅在标准文件类型时显示 */}
          {!customerOnly && (
            <>
              <div>
                <Label className="text-xs text-gray-500">产品名称 *</Label>
                <Input
                  className="mt-1"
                  list="product-list"
                  placeholder="输入或选择产品名称"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
                <datalist id="product-list">
                  {products.map((p: any) => (
                    <option key={p.id} value={p.productName} />
                  ))}
                </datalist>
              </div>

              <div>
                <Label className="text-xs text-gray-500">数量 (kg) *</Label>
                <Input
                  className="mt-1"
                  placeholder="如: 500、1000"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ""))}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 生成结果 */}
      <Card className={isComplete ? "border-blue-200" : "border-gray-200"}>
        <CardHeader>
          <CardTitle className="text-base">生成结果</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isComplete ? (
            <>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm break-all border">
                {generatedFilename}
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleCopy}
                  disabled={copied}
                >
                  {copied ? (
                    <>
                      <Check size={16} className="mr-1" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy size={16} className="mr-1" />
                      复制文件名
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw size={16} className="mr-1" />
                  重置
                </Button>
              </div>
              <p className="text-xs text-gray-400 text-center">
                {customerOnly
                  ? "格式: 年-月-日_文件类型_客户名称"
                  : "格式: 年-月-日_文件类型_客户名_产品名称_数量kg"}
              </p>
            </>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm space-y-1">
              <p>请填写上方所有必填字段</p>
              <p className="text-xs">
                标准文件: 日期 + 类型 + 客户 + 产品 + 数量
              </p>
              <p className="text-xs">
                客户资料类: 日期 + 类型 + 客户 即可
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 历史记录 */}
      <HistoryRecords />
    </div>
  );
}

/* ========== 本地历史记录 ========== */
function HistoryRecords() {
  const [records, setRecords] = useState<HistoryRecord[]>(loadHistory);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const handler = () => setRecords(loadHistory());
    window.addEventListener("storage", handler);
    const interval = setInterval(() => setRecords(loadHistory()), 1000);
    return () => {
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, []);

  const handleCopy = async (filename: string) => {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(filename);
        toast.success("已复制到剪贴板");
        return;
      } catch {
        // fallback
      }
    }
    // Fallback: execCommand
    try {
      const textArea = document.createElement("textarea");
      textArea.value = filename;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (success) {
        toast.success("已复制到剪贴板");
        return;
      }
    } catch {
      // ignore
    }
    toast.error("复制失败，请手动复制");
  };

  const handleDelete = (index: number) => {
    const next = records.filter((_, i) => i !== index);
    setRecords(next);
    saveHistory(next);
  };

  const handleClear = () => {
    setRecords([]);
    saveHistory([]);
  };

  if (records.length === 0) return null;

  const displayRecords = expanded ? records : records.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">最近生成</CardTitle>
          <div className="flex gap-2">
            {records.length > 5 && (
              <button
                className="text-xs text-blue-500 hover:underline"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "收起" : `展开全部 (${records.length})`}
              </button>
            )}
            <button
              className="text-xs text-gray-400 hover:text-red-500"
              onClick={handleClear}
            >
              清空
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayRecords.map((r, i) => (
          <div
            key={i}
            className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 group"
          >
            <button
              className="text-gray-400 hover:text-blue-500 shrink-0"
              onClick={() => handleCopy(r.filename)}
              title="复制"
            >
              <Copy size={14} />
            </button>
            <span className="font-mono text-xs flex-1 truncate">
              {r.filename}
            </span>
            <span className="text-xs text-gray-400 shrink-0">
              {new Date(r.createdAt).toLocaleDateString()}
            </span>
            <button
              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={() => handleDelete(i)}
              title="删除"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
