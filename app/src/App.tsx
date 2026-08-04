import { Routes, Route, Navigate } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import QuotationRules from "./pages/QuotationRules";
import QuotationRecords from "./pages/QuotationRecords";
import MetalPrices from "./pages/MetalPrices";

import SalesOrders from "./pages/SalesOrders";
import SampleOrders from "./pages/SampleOrders";
import Reports from "./pages/Reports";
import Products from "./pages/Products";
import FilenameGenerator from "./pages/FilenameGenerator";
import Login from "./pages/Login";
import DataManagement from "./pages/DataManagement";

export default function App() {
  return (
    <>
    <Toaster position="top-center" className="!top-1/2 !-translate-y-1/2" />
    <Routes>
      <Route
        path="/"
        element={
          <Layout>
            <Dashboard />
          </Layout>
        }
      />
      <Route
        path="/customers"
        element={
          <Layout>
            <Customers />
          </Layout>
        }
      />
      <Route
        path="/quotation-rules"
        element={
          <Layout>
            <QuotationRules />
          </Layout>
        }
      />
      <Route
        path="/quotation-records"
        element={
          <Layout>
            <QuotationRecords />
          </Layout>
        }
      />

      <Route
        path="/metal-prices"
        element={
          <Layout>
            <MetalPrices />
          </Layout>
        }
      />
      <Route
        path="/sales-orders"
        element={
          <Layout>
            <SalesOrders />
          </Layout>
        }
      />
      <Route
        path="/sample-orders"
        element={
          <Layout>
            <SampleOrders />
          </Layout>
        }
      />
      <Route
        path="/finance"
        element={<Navigate to="/sales-orders" replace />}
      />
      <Route
        path="/reports"
        element={
          <Layout>
            <Reports key="sales-reports" />
          </Layout>
        }
      />
      <Route
        path="/sample-reports"
        element={
          <Layout>
            <Reports key="sample-reports" mode="sample" />
          </Layout>
        }
      />
      <Route
        path="/products"
        element={
          <Layout>
            <Products />
          </Layout>
        }
      />
      <Route
        path="/filename-generator"
        element={
          <Layout>
            <FilenameGenerator />
          </Layout>
        }
      />
      <Route
        path="/data-management"
        element={
          <Layout>
            <DataManagement />
          </Layout>
        }
      />
      <Route path="/login" element={<Login />} />
    </Routes>
    </>
  );
}
