import { useState, useEffect } from "react";
import { Package, Plus } from "lucide-react";

export const SellerPortal = () => {
  const [materialName, setMaterialName] = useState("");
  const [brand, setBrand] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("Pcs"); // Default to Pcs
  const [price, setPrice] = useState("");
  const [stockLevel, setStockLevel] = useState("Available");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [catalog, setCatalog] = useState<any[]>([]);

  const baseUrl = `http://${window.location.hostname}:8000`;

  const fetchMyCatalog = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${baseUrl}/seller/materials`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCatalog(data);
      }
    } catch (error) {
      console.error("Failed to load catalog", error);
    }
  };

  useEffect(() => {
    fetchMyCatalog();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${baseUrl}/seller/materials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          material_name: materialName,
          brand: brand || "Generic/No Brand",
          quantity: parseFloat(quantity) || 0,
          unit: unit,
          price: parseFloat(price),
          stock_level: stockLevel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to add item");
      }

      setMessage({
        type: "success",
        text: "Item successfully added to your catalog!",
      });

      fetchMyCatalog();

      // Clear the form
      setMaterialName("");
      setBrand("");
      setQuantity("");
      setUnit("Pcs");
      setPrice("");
      setStockLevel("Available");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Seller Portal</h1>
        <p className="text-gray-600">
          Manage your hardware catalog for PENTABUILD logistics.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded font-medium ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Add Item Form */}
        <div className="lg:col-span-1">
          <form
            onSubmit={handleAddItem}
            className="bg-white p-6 rounded-lg shadow-sm border sticky top-4"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" /> Add New Material
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Material Name
                </label>
                <input
                  type="text"
                  required
                  value={materialName}
                  onChange={(e) => setMaterialName(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Portland Cement"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brand / Specs
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Republic, 40kg"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qty Available
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <select
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Bags">Bags</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Rolls">Rolls</option>
                    <option value="Kgs">Kgs</option>
                    <option value="Tons">Tons</option>
                    <option value="Liters">Liters</option>
                    <option value="Gallons">Gallons</option>
                    <option value="Meters">Meters</option>
                    <option value="Bundles">Bundles</option>
                    <option value="Truckloads">Truckloads</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price per Unit (₱)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Status
                </label>
                <select
                  value={stockLevel}
                  onChange={(e) => setStockLevel(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Available">Available (High Stock)</option>
                  <option value="Medium">Medium</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition"
              >
                Add to Catalog
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: Active Inventory List */}
        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" /> My Active
              Inventory ({catalog.length})
            </h2>

            <div className="space-y-3 mt-4">
              {catalog.length === 0 ? (
                <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                  No items in your catalog yet. Use the form to add your first
                  material.
                </div>
              ) : (
                catalog.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div>
                      <p className="font-bold text-gray-900 text-lg">
                        {item.material_name}
                      </p>
                      <p className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">
                        {item.brand || "Generic"}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                          Stock: {item.quantity || 0} {item.unit || "Pcs"}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            item.stock_level === "Out of Stock"
                              ? "text-red-500"
                              : "text-emerald-600"
                          }`}
                        >
                          • {item.stock_level}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-xl text-gray-900">
                        ₱{item.price.toFixed(2)}
                      </p>
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                        Per {item.unit || "Unit"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};