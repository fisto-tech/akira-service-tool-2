import re

def process():
    file_path = r"f:\Sham_Files\Sham\Projects\2026\web\AKIRA_SERVICE_TOOL\full-stack\frontend\src\pages\serviceMaterialResponse.jsx"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add state and handlers
    state_hooks = r"""  const \[selected, setSelected\] = useState\(null\);
  const \[infoSelected, setInfoSelected\] = useState\(null\);
  const \[hoveredRow, setHoveredRow\] = useState\(null\);
  const \[filterStatus, setFilterStatus\] = useState\("All"\);
  const \[currentPage, setCurrentPage\] = useState\(1\);
  const \[itemsPerPage, setItemsPerPage\] = useState\(10\);"""

    new_state_hooks = """  const [infoSelected, setInfoSelected] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [drafts, setDrafts] = useState({});

  const getDraft = (productId, product) => {
    if (drafts[productId]) return drafts[productId];
    return {
      testedBy: product.report?.testedBy || "",
      disposition: product.report?.disposition || "",
      fourMCategory: product.report?.fourMCategory || "",
      errorCode: product.report?.errorCode || "",
      problemDescription: product.report?.problemDescription || "",
      rootCause: product.report?.rootCause || "",
      partsReplacement: product.report?.partsReplacement || "",
      correctiveAction: product.report?.correctiveAction || "",
      completedDate: product.report?.completedDate || "",
      status: product.report?.status || "Under Testing",
      currentRemark: "",
      designators: product.report?.designators || "",
      image: product.report?.image || ""
    };
  };

  const handleDraftChange = (productId, product, field, value) => {
    setDrafts(prev => {
      const existing = prev[productId] || getDraft(productId, product);
      return {
        ...prev,
        [productId]: { ...existing, [field]: value, hasChanges: true }
      };
    });
  };

  const handleImageChange = (productId, product, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDrafts(prev => {
          const existing = prev[productId] || getDraft(productId, product);
          return {
            ...prev,
            [productId]: {
              ...existing,
              imageFile: file,
              imagePreview: reader.result,
              hasChanges: true
            }
          };
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveRow = async (entry, product, draft) => {
    if (!draft || !draft.hasChanges) return true;

    if (!draft.fourMCategory?.trim()) { alert(`4M Category is mandatory for ${product.productDescription}`); return false; }
    if (!draft.problemDescription?.trim()) { alert(`Problem Description is mandatory for ${product.productDescription}`); return false; }
    if (!draft.rootCause?.trim()) { alert(`Root Cause is mandatory for ${product.productDescription}`); return false; }
    if (!draft.correctiveAction?.trim()) { alert(`Corrective Action is mandatory for ${product.productDescription}`); return false; }
    if (draft.status === "Completed" && !draft.completedDate) { alert(`Completed Date is mandatory for ${product.productDescription}`); return false; }

    const historyEntry = {
      status: draft.status,
      disposition: draft.disposition,
      remark: draft.currentRemark,
      timestamp: new Date().toISOString()
    };

    const updatedReport = {
      testedBy: draft.testedBy,
      disposition: draft.disposition,
      fourMCategory: draft.fourMCategory,
      errorCode: draft.errorCode,
      problemDescription: draft.problemDescription,
      rootCause: draft.rootCause,
      partsReplacement: draft.partsReplacement,
      correctiveAction: draft.correctiveAction,
      completedDate: draft.completedDate,
      status: draft.status,
      currentRemark: draft.currentRemark,
      designators: draft.designators,
      image: product.report?.image || "",
      lastUpdated: new Date().toISOString(),
      history: [...(product.report?.history || []), historyEntry]
    };

    await updateEntry(entry.id, product._pid, updatedReport, draft.imageFile);
    
    setDrafts(prev => {
      const next = { ...prev };
      if (next[product._pid]) {
        next[product._pid] = { ...next[product._pid], hasChanges: false, currentRemark: "" };
      }
      return next;
    });
    return true;
  };

  const handleBulkSave = async () => {
    const productsToSave = [];
    for (const { entry, product } of myItems) {
      const draft = drafts[product._pid];
      if (draft && draft.hasChanges) {
        productsToSave.push({ entry, product, draft });
      }
    }

    if (productsToSave.length === 0) {
      return alert("No changes to save.");
    }

    try {
      await Promise.all(productsToSave.map(({ entry, product, draft }) => saveRow(entry, product, draft)));
      alert("Bulk save completed successfully!");
    } catch (err) {
      alert("Some items failed to save.");
    }
  };"""

    content = re.sub(state_hooks, new_state_hooks, content)

    # Add DataLists
    datalist_html = """    <div className="w-full font-sans">
      <datalist id="errorCodeList">
        {errorCodeHistory?.map((opt, i) => <option key={i} value={opt} />)}
      </datalist>
      <datalist id="problemDescList">
        {problemDescHistory?.map((opt, i) => <option key={i} value={opt} />)}
      </datalist>"""
    
    content = content.replace('<div className="w-full font-sans">', datalist_html)

    # Add bulk save button next to Live Sync Enabled
    bulk_save_html = """<div className="flex items-center gap-[0.4vw] px-[0.8vw] py-[0.3vw] bg-emerald-50 border border-emerald-100 rounded-full">
              <div className="w-[0.4vw] h-[0.4vw] rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[0.65vw] font-bold text-emerald-700 uppercase tracking-widest">Live Sync Enabled</span>
            </div>
            <button onClick={handleBulkSave} className="flex items-center gap-[0.5vw] px-[1vw] py-[0.4vw] bg-emerald-600 hover:bg-emerald-700 text-white rounded-[0.4vw] text-[0.75vw] font-bold shadow-md shadow-emerald-900/20 transition-all ml-[1vw]">
              <Send className="w-[0.9vw] h-[0.9vw]" />
              Bulk Save
            </button>"""
            
    content = content.replace("""<div className="flex items-center gap-[0.4vw] px-[0.8vw] py-[0.3vw] bg-emerald-50 border border-emerald-100 rounded-full">
              <div className="w-[0.4vw] h-[0.4vw] rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[0.65vw] font-bold text-emerald-700 uppercase tracking-widest">Live Sync Enabled</span>
            </div>""", bulk_save_html)

    # Now replace the tbody rows...
    # It's better to just write the new tr manually because regexing the entire TR is brittle.
    tbody_start = r"                        <motion.tr"
    tbody_end = r"                        </motion.tr>"
    # I'll replace the inside of motion.tr completely.
    
    # Wait, writing a python script to do it all is complex. I'll just write it.

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

process()
