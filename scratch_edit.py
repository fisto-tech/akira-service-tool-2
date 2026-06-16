import re
import sys

def process():
    file_path = r"f:\Sham_Files\Sham\Projects\2026\web\AKIRA_SERVICE_TOOL\full-stack\frontend\src\pages\serviceMaterialResponse.jsx"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Replace Service Response Modal
    content = re.sub(r"// ── Service Response Modal ──.*?// ── Status Chips Configuration ──", r"""
const STATUS_OPTIONS = ["Under Testing", "Repair in Progress", "Pending", "Completed", "Not Repairable"];
const DISPOSITION_OPTIONS = ["Repaired", "Replaced", "Scrap", "Return As Is"];

// ── Status Chips Configuration ──""", content, flags=re.DOTALL)

    # 2. Update columns
    old_columns = r"""  const columns = \[.*?\];"""
    new_columns = """  const columns = [
    { key: "sno", label: "S.No", align: "text-center" },
    { key: "date", label: "Date", align: "text-left", minW: "min-w-[7vw]" },
    { key: "ref", label: "Ref No", align: "text-left", minW: "min-w-[7vw]" },
    { key: "customer", label: "Customer", align: "text-left", minW: "min-w-[12vw]" },
    { key: "product", label: "Product", align: "text-left", minW: "min-w-[12vw]" },
    { key: "board", label: "Board Type", align: "text-left", minW: "min-w-[8vw]" },
    { key: "serial", label: "Serial No", align: "text-left", minW: "min-w-[8vw]" },
    { key: "testedBy", label: "Tested By", align: "text-left", minW: "min-w-[10vw]" },
    { key: "fourM", label: "4M Category", align: "text-left", minW: "min-w-[10vw]" },
    { key: "errorCode", label: "Error Code", align: "text-left", minW: "min-w-[8vw]" },
    { key: "problemDesc", label: "Problem Desc", align: "text-left", minW: "min-w-[12vw]" },
    { key: "designators", label: "Designators", align: "text-left", minW: "min-w-[10vw]" },
    { key: "rootCause", label: "Root Cause", align: "text-left", minW: "min-w-[12vw]" },
    { key: "partsReplaced", label: "Parts Replaced", align: "text-left", minW: "min-w-[12vw]" },
    { key: "correctiveAction", label: "Corrective Action", align: "text-left", minW: "min-w-[12vw]" },
    { key: "disposition", label: "Disposition", align: "text-left", minW: "min-w-[10vw]" },
    { key: "completionDate", label: "Completion Date", align: "text-left", minW: "min-w-[10vw]" },
    { key: "status", label: "Status", align: "text-center", minW: "min-w-[10vw]" },
    { key: "remarks", label: "Action Remark", align: "text-center", minW: "min-w-[10vw]" },
    { key: "image", label: "Image", align: "text-center", minW: "min-w-[6vw]" },
    { key: "info", label: "Info", align: "text-center" },
    { key: "action", label: "Action", align: "text-center", minW: "min-w-[8vw]" },
  ];"""
    content = re.sub(old_columns, new_columns, content, flags=re.DOTALL)

    # We will write the file, and then I'll use another tool call to finish the rest.
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

process()
