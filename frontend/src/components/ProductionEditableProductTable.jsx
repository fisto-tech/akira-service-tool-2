import React, { useState, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { 
  GripVertical, 
  Trash2, 
  Copy, 
  Search, 
  Plus,
  ChevronDown,
  Calendar,
  ScanBarcode
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const COLUMN_FIELDS = [
  "productDescription",
  "productCode",
  "boardType",
  "problem",
  "stage",
  "qty",
  "serialNumber",
  "disposition",
  "raisedTo"
];

const DropdownPortal = ({ children, targetRect }) => {
  if (!targetRect) return null;
  const style = {
    position: 'fixed',
    top: targetRect.bottom + 4,
    left: targetRect.left,
    width: targetRect.width,
    zIndex: 9999,
  };
  return ReactDOM.createPortal(
    <div style={style} className="dropdown-portal-container">
      {children}
    </div>,
    document.body
  );
};

const ProductionEditableProductTable = ({ 
  products, 
  setProducts, 
  customerCode, 
  customerDb, 
  boardTypes = [],
  employees = [],
  stageOptions = [],
  dispositionOptions = [],
  isReadOnly,
  allowPartialEdit,
  onDuplicate,
  onRemove
}) => {
  const [activeDropdown, setActiveDropdown] = useState(null); 
  const [searchTerm, setSearchTerm] = useState("");
  const tableContainerRef = useRef(null);

  const [selection, setSelection] = useState(null); 
  const [isSelecting, setIsSelecting] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (event.target.closest('.dropdown-container')) return;
      if (event.target.closest('.description-input')) return;
      setActiveDropdown(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isReadOnly || !selection) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { startRow, endRow } = selection;
        const minR = Math.min(startRow, endRow);
        const maxR = Math.min(Math.max(startRow, endRow), products.length - 1);
        const newProducts = products.filter((_, idx) => idx < minR || idx > maxR);
        setProducts(newProducts);
        setSelection(null);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, products, isReadOnly]);

  const productsForCustomer = useMemo(() => {
    if (!customerCode || !customerDb) return [];
    const codeStr = String(customerCode);
    if (customerDb[codeStr]) return customerDb[codeStr];
    const flat = Array.isArray(customerDb) ? customerDb : Object.values(customerDb).flat();
    return flat.filter((r) => String(r.partyCode || r.party_code).toLowerCase() === codeStr.toLowerCase());
  }, [customerDb, customerCode]);

  const filteredProds = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return productsForCustomer.filter(
      (p) =>
        !s ||
        (p.itemDescription && p.itemDescription.toLowerCase().includes(s)) ||
        (p.itemCode && p.itemCode.toLowerCase().includes(s))
    );
  }, [productsForCustomer, searchTerm]);

  const onDragEnd = (result) => {
    if (!result.destination || isReadOnly) return;
    const items = Array.from(products);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setProducts(items);
    setSelection(null);
  };

  const handleUpdate = (id, field, value) => {
    if (isReadOnly) return;
    setProducts((prev) =>
      prev.map((p) => (p._pid === id ? { ...p, [field]: value } : p))
    );
  };

  const selectProduct = (id, p) => {
    setProducts(prev => prev.map(prod => 
      prod._pid === id ? {
        ...prod,
        productCode: p.itemCode || p.productCode || "",
        productDescription: p.itemDescription || p.productDescription || "",
      } : prod
    ));
    setActiveDropdown(null);
    setSearchTerm("");
  };

  const handleCellMouseDown = (rowIndex, colIndex, e) => {
    if (isReadOnly) return;
    if (e.target.closest('.dropdown-container')) return;

    if (e.shiftKey && selection) {
      setSelection(prev => ({ ...prev, endCol: colIndex, endRow: rowIndex }));
    } else {
      setSelection({
        startRow: rowIndex,
        startCol: colIndex,
        endRow: rowIndex,
        endCol: colIndex
      });
      setIsSelecting(true);
    }
  };

  const handleFillHandleMouseDown = (e) => {
    if (isReadOnly) return;
    e.stopPropagation();
    setIsFilling(true);
  };

  const handleCellMouseEnter = (rowIndex, colIndex) => {
    if (isSelecting) {
      setSelection(prev => ({
        ...prev,
        endCol: colIndex,
        endRow: rowIndex 
      }));
    } else if (isFilling) {
      setSelection(prev => ({
        ...prev,
        endRow: rowIndex,
        endCol: colIndex
      }));
    }
  };

  const handleMouseUp = () => {
    if (isFilling && selection) {
      const { startRow, startCol, endRow, endCol } = selection;
      const sourceRow = products[startRow];
      const minR = Math.min(startRow, endRow);
      const maxR = Math.max(startRow, endRow);
      const minC = Math.min(startCol, endCol);
      const maxC = Math.max(startCol, endCol);

      let newProducts = [...products];

      if (maxR >= products.length) {
        const rowsToAdd = maxR - products.length + 1;
        for (let i = 0; i < rowsToAdd; i++) {
          newProducts.push({
            ...sourceRow,
            _pid: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            serialNumber: "", 
            finalStatus: "Pending",
            report: null
          });
        }
      }

      const limitR = Math.min(maxR, products.length - 1);
      for (let r = minR; r <= limitR; r++) {
        if (r === startRow) continue; 
        for (let c = minC; c <= maxC; c++) {
          const field = COLUMN_FIELDS[c];
          if (field && field !== 'productCode' && field !== '_pid') {
            newProducts[r] = { ...newProducts[r], [field]: sourceRow[field] };
          }
        }
      }
      setProducts(newProducts);
    }
    setIsSelecting(false);
    setIsFilling(false);
  };

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (isFilling && selection && tableContainerRef.current) {
        const rect = tableContainerRef.current.getBoundingClientRect();
        if (e.clientY > rect.bottom) {
          const pixelsBelow = e.clientY - rect.bottom;
          const extraRows = Math.min(15, Math.floor(pixelsBelow / 40) + 1);
          setSelection(prev => ({
            ...prev,
            endRow: products.length + extraRows - 1
          }));
        } else if (e.clientY < rect.bottom) {
            const rowHeight = 40; 
            const yInTable = e.clientY - rect.top;
            const targetRow = Math.floor(yInTable / rowHeight);
            setSelection(prev => ({ ...prev, endRow: Math.max(0, targetRow) }));
        }
      }
    };
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isFilling, selection, products.length]);

  const getCellClass = (rowIndex, colIndex) => {
    if (!selection) return "border border-gray-300";
    const { startRow, startCol, endRow, endCol } = selection;
    const minR = Math.min(startRow, endRow);
    const maxR = Math.max(startRow, endRow);
    const minC = Math.min(startCol, endCol);
    const maxC = Math.max(startCol, endCol);
    if (rowIndex < minR || rowIndex > maxR || colIndex < minC || colIndex > maxC) return "border border-gray-300";
    let cls = "border border-blue-500 bg-blue-50/20 z-10";
    if (rowIndex === minR) cls += " border-t-2";
    if (rowIndex === maxR) cls += " border-b-2";
    if (colIndex === minC) cls += " border-l-2";
    if (colIndex === maxC) cls += " border-r-2";
    return cls;
  };

  const renderFillHandle = (rowIndex, colIndex) => {
    if (isReadOnly || !selection) return null;
    const { startRow, startCol, endRow, endCol } = selection;
    const maxR = Math.max(startRow, endRow);
    const maxC = Math.max(startCol, endCol);
    if (rowIndex === maxR && colIndex === maxC) {
      return (
        <div 
          data-fill-handle="true"
          onMouseDown={handleFillHandleMouseDown}
          className="absolute bottom-[-5px] right-[-5px] w-[10px] h-[10px] bg-blue-600 border-2 border-white cursor-crosshair z-[60] shadow-sm rounded-sm"
        />
      );
    }
    return null;
  };

  const openDropdown = (id, target) => {
    if (isReadOnly) return;
    const rect = target.getBoundingClientRect();
    setActiveDropdown({ id, rect });
    setSearchTerm("");
  };

  return (
    <div 
      ref={tableContainerRef}
      className="w-full overflow-x-auto border border-gray-200 rounded-[0.6vw] bg-white mb-[15vw]"
    >
      <table className="w-full border-collapse text-[0.8vw]">
        <thead className="bg-blue-50/80 border-b border-gray-300 sticky top-0 z-20 shadow-sm">
          <tr>
            {!isReadOnly && <th className="w-[4vw] min-w-[60px] py-[0.8vw] px-[0.5vw]"></th>}
            <th className="w-[4vw] min-w-[60px] py-[0.8vw] px-[0.5vw] text-center text-black font-bold uppercase tracking-wider whitespace-nowrap">#</th>
            <th className="min-w-[30vw] py-[0.8vw] px-[0.8vw] text-left text-black font-bold uppercase tracking-wider whitespace-nowrap">Product Description</th>
            <th className="w-[12vw] min-w-[150px] py-[0.8vw] px-[0.8vw] text-left text-black font-bold uppercase tracking-wider whitespace-nowrap">Code</th>
            <th className="w-[12vw] min-w-[160px] py-[0.8vw] px-[0.8vw] text-left text-black font-bold uppercase tracking-wider whitespace-nowrap">Board Type</th>
            <th className="w-[15vw] min-w-[200px] py-[0.8vw] px-[0.8vw] text-left text-black font-bold uppercase tracking-wider whitespace-nowrap">Problem</th>
            <th className="w-[10vw] min-w-[140px] py-[0.8vw] px-[0.8vw] text-left text-black font-bold uppercase tracking-wider whitespace-nowrap">Stage</th>
            <th className="w-[7vw] min-w-[120px] py-[0.8vw] px-[0.8vw] text-center text-black font-bold uppercase tracking-wider whitespace-nowrap">Qty</th>
            <th className="w-[12vw] min-w-[180px] py-[0.8vw] px-[0.8vw] text-left text-black font-bold uppercase tracking-wider whitespace-nowrap">Batch / SN</th>
            <th className="w-[10vw] min-w-[150px] py-[0.8vw] px-[0.8vw] text-left text-black font-bold uppercase tracking-wider whitespace-nowrap">Disposition</th>
            <th className="w-[12vw] min-w-[180px] py-[0.8vw] px-[0.8vw] text-left text-black font-bold uppercase tracking-wider whitespace-nowrap">Raised To</th>
            {!isReadOnly && <th className="w-[10vw] min-w-[120px] py-[0.8vw] px-[0.8vw] text-center text-black font-bold uppercase tracking-wider whitespace-nowrap">Actions</th>}
          </tr>
        </thead>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="products-list">
            {(provided) => (
              <tbody {...provided.droppableProps} ref={provided.innerRef}>
                {products.map((prod, index) => (
                  <Draggable 
                    key={prod._pid} 
                    draggableId={prod._pid} 
                    index={index}
                    isDragDisabled={isReadOnly || isSelecting || isFilling}
                  >
                    {(provided, snapshot) => (
                      <tr
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors ${snapshot.isDragging ? "bg-white shadow-lg ring-1 ring-blue-200 z-50 table" : ""}`}
                      >
                        {!isReadOnly && (
                          <td className="py-[0.6vw] px-[0.5vw] text-center align-middle" {...provided.dragHandleProps}>
                            <GripVertical className="w-[1vw] h-[1vw] text-gray-700 cursor-grab active:cursor-grabbing" />
                          </td>
                        )}
                        <td className="py-[0.6vw] px-[0.5vw] text-center align-middle font-bold text-black border border-gray-300">
                          {index + 1}
                        </td>
                        
                        <td 
                          className={`py-[0.6vw] px-[0.8vw] relative transition-all ${getCellClass(index, 0)}`}
                          onMouseDown={(e) => handleCellMouseDown(index, 0, e)}
                          onMouseEnter={() => handleCellMouseEnter(index, 0)}
                          onDoubleClick={(e) => openDropdown(prod._pid, e.currentTarget)}
                        >
                          <div className="relative flex items-center group h-full">
                            <input
                              type="text"
                              autoComplete="off"
                              value={activeDropdown?.id === prod._pid ? searchTerm : prod.productDescription}
                              onChange={(e) => {
                                if (activeDropdown?.id === prod._pid) {
                                  setSearchTerm(e.target.value);
                                } else {
                                  handleUpdate(prod._pid, "productDescription", e.target.value);
                                  handleUpdate(prod._pid, "productCode", "");
                                }
                              }}
                              onFocus={(e) => openDropdown(prod._pid, e.currentTarget.parentElement.parentElement)}
                              onClick={(e) => openDropdown(prod._pid, e.currentTarget.parentElement.parentElement)}
                              placeholder={customerCode ? "Search or enter description..." : "Select customer first"}
                              disabled={!customerCode || isReadOnly}
                              className={`w-full bg-transparent border-none rounded-[0.3vw] py-[0.4vw] px-[0.6vw] outline-none transition-all text-black font-bold disabled:bg-transparent cursor-text description-input`}
                            />
                            {!isReadOnly && customerCode && (
                              <Search className="w-[0.8vw] h-[0.8vw] text-gray-700 absolute right-[0.6vw] pointer-events-none group-focus-within:text-blue-500" />
                            )}
                          </div>
                          {renderFillHandle(index, 0)}
                          
                          {activeDropdown?.id === prod._pid && (
                            <DropdownPortal targetRect={activeDropdown.rect}>
                              <div className="bg-white border-2 border-blue-500 shadow-2xl rounded-[0.4vw] max-h-[15vw] overflow-y-auto dropdown-container">
                                {!customerCode ? (
                                    <div className="p-[1vw] text-center text-red-500 font-bold text-[0.8vw]">Please select a customer first.</div>
                                ) : filteredProds.length > 0 ? (
                                  filteredProds.map((p, i) => (
                                    <div
                                      key={i}
                                      onMouseDown={(e) => {
                                          e.preventDefault(); 
                                          e.stopPropagation();
                                          selectProduct(prod._pid, p);
                                      }}
                                      className="p-[0.6vw] hover:bg-blue-100 cursor-pointer border-b border-gray-100 last:border-0"
                                    >
                                      <div className="font-bold text-gray-900 text-[0.8vw]">{p.itemDescription || p.productDescription}</div>
                                      <div className="text-[0.7vw] text-gray-700 flex items-center gap-[0.4vw] mt-[0.1vw]">
                                        <span className="bg-gray-100 px-[0.3vw] rounded font-mono border border-gray-200">{p.itemCode || p.productCode}</span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-[1vw] text-center text-gray-700 font-medium italic">No products found for {customerCode}</div>
                                )}
                              </div>
                            </DropdownPortal>
                          )}
                        </td>

                        <td className={`py-[0.6vw] px-[0.8vw] relative ${getCellClass(index, 1)}`} onMouseDown={(e) => handleCellMouseDown(index, 1, e)} onMouseEnter={() => handleCellMouseEnter(index, 1)}>
                          <div className="text-black px-[0.6vw] py-[0.4vw] rounded-[0.3vw] font-bold text-[0.75vw]">{prod.productCode || "—"}</div>
                          {renderFillHandle(index, 1)}
                        </td>

                        <td className={`py-[0.6vw] px-[0.8vw] relative transition-all ${getCellClass(index, 2)}`} onMouseDown={(e) => handleCellMouseDown(index, 2, e)} onMouseEnter={() => handleCellMouseEnter(index, 2)}>
                          <select
                            value={prod.boardType || ""}
                            onChange={(e) => handleUpdate(prod._pid, "boardType", e.target.value)}
                            disabled={isReadOnly}
                            className="w-full bg-transparent border-none rounded-[0.3vw] py-[0.4vw] px-[0.2vw] outline-none transition-all text-black font-bold disabled:bg-transparent"
                          >
                            <option value="">Select</option>
                            {boardTypes.map(bt => (
                              <option key={bt.id || bt._id} value={bt.name}>{bt.name}</option>
                            ))}
                          </select>
                          {renderFillHandle(index, 2)}
                        </td>

                        <td className={`py-[0.6vw] px-[0.8vw] relative transition-all ${getCellClass(index, 3)}`} onMouseDown={(e) => handleCellMouseDown(index, 3, e)} onMouseEnter={() => handleCellMouseEnter(index, 3)}>
                          <div className="relative flex items-center group">
                            <input type="text" autoComplete="off" value={prod.problem || ""} onChange={(e) => handleUpdate(prod._pid, "problem", e.target.value)} placeholder="Problem Description" disabled={isReadOnly} className="w-full bg-transparent border-none rounded-[0.3vw] py-[0.4vw] px-[0.6vw] outline-none transition-all text-black font-bold disabled:bg-transparent" />
                          </div>
                          {renderFillHandle(index, 3)}
                        </td>

                        <td className={`py-[0.6vw] px-[0.8vw] relative transition-all ${getCellClass(index, 4)}`} onMouseDown={(e) => handleCellMouseDown(index, 4, e)} onMouseEnter={() => handleCellMouseEnter(index, 4)}>
                          <select
                            value={prod.stage || ""}
                            onChange={(e) => handleUpdate(prod._pid, "stage", e.target.value)}
                            disabled={isReadOnly}
                            className="w-full bg-transparent border-none rounded-[0.3vw] py-[0.4vw] px-[0.2vw] outline-none transition-all text-black font-bold disabled:bg-transparent"
                          >
                            <option value="">Select</option>
                            {stageOptions.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          {renderFillHandle(index, 4)}
                        </td>

                        <td className={`py-[0.6vw] px-[0.8vw] relative transition-all ${getCellClass(index, 5)}`} onMouseDown={(e) => handleCellMouseDown(index, 5, e)} onMouseEnter={() => handleCellMouseEnter(index, 5)}>
                          <input type="number" min="1" value={prod.qty} onChange={(e) => handleUpdate(prod._pid, "qty", e.target.value)} disabled={isReadOnly} className="w-full bg-transparent border-none rounded-[0.3vw] py-[0.4vw] px-[0.6vw] outline-none transition-all text-black font-bold text-center disabled:bg-transparent" />
                          {renderFillHandle(index, 5)}
                        </td>

                        <td className={`py-[0.6vw] px-[0.8vw] relative transition-all ${getCellClass(index, 6)}`} onMouseDown={(e) => handleCellMouseDown(index, 6, e)} onMouseEnter={() => handleCellMouseEnter(index, 6)}>
                          <div className="relative flex items-center group">
                            <input 
                              type="text" 
                              autoComplete="off" 
                              value={prod.serialNumber || ""} 
                              onChange={(e) => handleUpdate(prod._pid, "serialNumber", e.target.value)} 
                              placeholder="SN-XXXX" 
                              disabled={isReadOnly} 
                              className="w-full bg-transparent border-none rounded-[0.3vw] py-[0.4vw] px-[0.6vw] pr-[2.2vw] outline-none transition-all text-black font-bold disabled:bg-transparent" 
                            />
                            {!isReadOnly && (
                              <button type="button" className="absolute right-[0.4vw] p-[0.3vw] text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded transition-all">
                                <ScanBarcode className="w-[1vw] h-[1vw]" />
                              </button>
                            )}
                          </div>
                          {renderFillHandle(index, 6)}
                        </td>

                        <td className={`py-[0.6vw] px-[0.8vw] relative transition-all ${getCellClass(index, 7)}`} onMouseDown={(e) => handleCellMouseDown(index, 7, e)} onMouseEnter={() => handleCellMouseEnter(index, 7)}>
                          <select
                            value={prod.disposition || ""}
                            onChange={(e) => handleUpdate(prod._pid, "disposition", e.target.value)}
                            disabled={isReadOnly}
                            className="w-full bg-transparent border-none rounded-[0.3vw] py-[0.4vw] px-[0.2vw] outline-none transition-all text-black font-bold disabled:bg-transparent"
                          >
                            <option value="">Select</option>
                            {dispositionOptions.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                          {renderFillHandle(index, 7)}
                        </td>

                        <td className={`py-[0.6vw] px-[0.8vw] relative transition-all ${getCellClass(index, 8)}`} onMouseDown={(e) => handleCellMouseDown(index, 8, e)} onMouseEnter={() => handleCellMouseEnter(index, 8)}>
                          <select
                            value={prod.raisedTo || ""}
                            onChange={(e) => handleUpdate(prod._pid, "raisedTo", e.target.value)}
                            disabled={isReadOnly}
                            className="w-full bg-transparent border-none rounded-[0.3vw] py-[0.4vw] px-[0.2vw] outline-none transition-all text-black font-bold disabled:bg-transparent"
                          >
                            <option value="">Select</option>
                            {employees.map(e => (
                              <option key={e.userId} value={e.userId}>{e.name}</option>
                            ))}
                          </select>
                          {renderFillHandle(index, 8)}
                        </td>

                        {!isReadOnly && (
                          <td className="py-[0.6vw] px-[0.8vw] border border-gray-300">
                            <div className="flex items-center justify-center gap-[0.5vw]">
                              <button type="button" onClick={() => onDuplicate(prod)} className="p-[0.4vw] text-blue-500 hover:bg-blue-100 rounded-[0.3vw] transition-colors"><Copy className="w-[1vw] h-[1vw]" /></button>
                              <button type="button" onClick={() => onRemove(prod._pid)} className="p-[0.4vw] text-red-500 hover:bg-red-100 rounded-[0.3vw] transition-colors"><Trash2 className="w-[1vw] h-[1vw]" /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )}
                  </Draggable>
                ))}
                
                {isFilling && selection && selection.endRow >= products.length && (
                   <tr className="bg-blue-50/20 border-b-2 border-blue-400">
                     <td colSpan={10} className="py-[1vw] text-center text-blue-700 font-bold italic text-[0.8vw] bg-blue-100/50">
                        + Release mouse to add {selection.endRow - products.length + 1} new duplicate rows
                     </td>
                   </tr>
                )}

                {provided.placeholder}
              </tbody>
            )}
          </Droppable>
        </DragDropContext>
      </table>
    </div>
  );
};

export default ProductionEditableProductTable;
