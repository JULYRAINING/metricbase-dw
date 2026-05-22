import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import Dashboard from "./views/Dashboard";
import Dimensions from "./views/Dimensions";
import FactTables from "./views/FactTables";
import Metrics from "./views/Metrics";
import ModelBuilder from "./views/ModelBuilder";
import Categories from "./views/Categories";
import PhysicalTables from "./views/PhysicalTables";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "dimensions", Component: Dimensions },
      { path: "fact-tables", Component: FactTables },
      { path: "physical-tables", Component: PhysicalTables },
      { path: "metrics", Component: Metrics },
      { path: "model-builder", Component: ModelBuilder },
      { path: "categories", Component: Categories },
    ],
  },
]);