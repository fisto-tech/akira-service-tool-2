import re

def process():
    file_path = r"f:\Sham_Files\Sham\Projects\2026\web\AKIRA_SERVICE_TOOL\full-stack\frontend\src\pages\serviceMaterialResponse.jsx"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Re-write the motion.tr contents.
    
    # Let's find the loop start
    start_str = """const StatusIcon = statusCfg.icon;
                    const isHovered = hoveredRow === idx;"""
    
    new_start_str = """const StatusIcon = statusCfg.icon;
                    const isHovered = hoveredRow === idx;
                    const isClaimedByMe = product.assignedTo === (currentUser?.userId || currentUser?.id);
                    const draft = isClaimedByMe ? getDraft(product._pid, product) : null;
                    const hc = (field, val) => handleDraftChange(product._pid, product, field, val);"""
                    
    content = content.replace(start_str, new_start_str)

    # I will replace the motion.tr inside with the full new code.
    tr_start = r"                          {/\* S\.No \*/}"
    tr_end = r"                        </motion\.tr>"

    # Use regex to replace the inside of the motion.tr
    new_tr = """
                          {/* S.No */}
                          <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-300 bg-white sticky left-0 z-10 shadow-[4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                            <span className="inline-flex items-center justify-center w-[1.5vw] h-[1.5vw] rounded-full bg-gray-100 text-[0.68vw] font-bold text-gray-600">
                              {((currentPage - 1) * itemsPerPage) + idx + 1}
                            </span>
                          </td>

                          {/* Date */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            <div className="flex items-center gap-[0.3vw]">
                              <Calendar className="w-[0.75vw] h-[0.75vw] text-blue-600" />
                              <span className="text-[0.75vw] text-gray-700 font-medium whitespace-nowrap">
                                {entry.date ? fmtDate(entry.date) : "—"}
                              </span>
                            </div>
                          </td>

                          {/* Ref No */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            <span className="text-[0.75vw] font-semibold text-gray-800 whitespace-nowrap">
                              {entry.refNoCustomer || entry.refNo || "—"}
                            </span>
                          </td>

                          {/* Customer */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            <div className="flex items-center gap-[0.5vw]">
                              <div className="w-[1.6vw] h-[1.6vw] rounded-full bg-gradient-to-br from-blue-700 to-blue-600 flex items-center justify-center text-white text-[0.55vw] font-bold flex-shrink-0">
                                {entry.customerName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                              </div>
                              <div className="min-w-[10vw]">
                                <div className="text-[0.75vw] font-semibold text-gray-800 break-words whitespace-normal">{entry.customerName}</div>
                                <div className="text-[0.65vw] text-gray-600 mt-[.2vw]">CUS: {entry.customerCode || "—"}</div>
                              </div>
                            </div>
                          </td>

                          {/* Product */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            <div className="min-w-[10vw]">
                              <div className="text-[0.75vw] font-semibold text-gray-800 break-words whitespace-normal" title={product.productDescription}>
                                {product.productDescription}
                              </div>
                              <div className="text-[0.65vw] text-gray-600 mt-[.2vw]">{product.productCode || "—"}</div>
                            </div>
                          </td>

                          {/* Board Type */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            <span className="text-[0.75vw] font-semibold text-gray-700 whitespace-nowrap">
                              {product.boardType || "—"}
                            </span>
                          </td>

                          {/* Serial No */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            <span className="text-[0.75vw] font-semibold text-gray-700 whitespace-nowrap">
                              {product.serialNumber || "—"}
                            </span>
                          </td>

                          {/* Tested By */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            {isClaimedByMe ? (
                              <select value={draft.testedBy} onChange={e => hc("testedBy", e.target.value)} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]">
                                <option value="">Select</option>
                                {employees.map(e => <option key={e.userId} value={e.name}>{e.name}</option>)}
                              </select>
                            ) : (
                              <span className="text-[0.75vw] whitespace-nowrap">{product.report?.testedBy || "—"}</span>
                            )}
                          </td>

                          {/* 4M Category */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            {isClaimedByMe ? (
                              <select value={draft.fourMCategory} onChange={e => hc("fourMCategory", e.target.value)} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]">
                                <option value="">Select</option>
                                {fourMCategories?.map(opt => <option key={opt._id || opt.id} value={opt.name}>{opt.name}</option>)}
                              </select>
                            ) : (
                              <span className="text-[0.75vw] whitespace-nowrap">{product.report?.fourMCategory || "—"}</span>
                            )}
                          </td>

                          {/* Error Code */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            {isClaimedByMe ? (
                              <input type="text" list="errorCodeList" value={draft.errorCode} onChange={e => hc("errorCode", e.target.value)} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[6vw]" placeholder="Code..." />
                            ) : (
                              <span className="text-[0.75vw] whitespace-nowrap">{product.report?.errorCode || "—"}</span>
                            )}
                          </td>

                          {/* Problem Description */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            {isClaimedByMe ? (
                              <input type="text" list="problemDescList" value={draft.problemDescription} onChange={e => hc("problemDescription", e.target.value)} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[10vw]" placeholder="Problem..." />
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.problemDescription || "—"}</span>
                            )}
                          </td>

                          {/* Designators */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            {isClaimedByMe ? (
                              <select value={draft.designators} onChange={e => hc("designators", e.target.value)} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]">
                                <option value="">Select</option>
                                {employees.map(e => <option key={e.userId} value={e.name}>{e.name}</option>)}
                              </select>
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.designators || "—"}</span>
                            )}
                          </td>

                          {/* Root Cause */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            {isClaimedByMe ? (
                              <textarea value={draft.rootCause} onChange={e => hc("rootCause", e.target.value)} rows={1} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[10vw] resize-y min-h-[1.5vw]" placeholder="Root Cause..." />
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.rootCause || "—"}</span>
                            )}
                          </td>

                          {/* Parts Replaced */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            {isClaimedByMe ? (
                              <textarea value={draft.partsReplacement} onChange={e => hc("partsReplacement", e.target.value)} rows={1} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[10vw] resize-y min-h-[1.5vw]" placeholder="Parts..." />
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.partsReplacement || "—"}</span>
                            )}
                          </td>

                          {/* Corrective Action */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            {isClaimedByMe ? (
                              <textarea value={draft.correctiveAction} onChange={e => hc("correctiveAction", e.target.value)} rows={1} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[10vw] resize-y min-h-[1.5vw]" placeholder="Action..." />
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.correctiveAction || "—"}</span>
                            )}
                          </td>

                          {/* Disposition */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            {isClaimedByMe ? (
                              <select value={draft.disposition} onChange={e => hc("disposition", e.target.value)} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]">
                                <option value="">Select</option>
                                {DISPOSITION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <span className="text-[0.75vw]">{product.report?.disposition || "—"}</span>
                            )}
                          </td>

                          {/* Completion Date */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            {isClaimedByMe ? (
                              <input type="date" value={draft.completedDate} onChange={e => hc("completedDate", e.target.value)} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]" />
                            ) : (
                              <span className="text-[0.75vw] whitespace-nowrap">{product.report?.completedDate ? fmtDate(product.report.completedDate) : "—"}</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-300">
                            {isClaimedByMe ? (
                              <select value={draft.status} onChange={e => hc("status", e.target.value)} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 font-semibold min-w-[9vw]">
                                {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <span className={`inline-flex items-center gap-[0.3vw] px-[0.6vw] py-[0.25vw] rounded-full border text-[0.68vw] font-semibold whitespace-nowrap ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}>
                                <StatusIcon className="w-[0.8vw] h-[0.8vw]" />
                                {pStatus}
                              </span>
                            )}
                          </td>

                          {/* Remarks */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300">
                            {isClaimedByMe ? (
                              <input type="text" value={draft.currentRemark} onChange={e => hc("currentRemark", e.target.value)} className="w-full text-[0.75vw] border border-gray-300 rounded p-[0.3vw] outline-none focus:border-blue-500 min-w-[8vw]" placeholder="Remark..." />
                            ) : (
                              <span className="text-[0.75vw] text-gray-700 font-semibold">{pRemark}</span>
                            )}
                          </td>

                          {/* Image Upload */}
                          <td className="px-[0.8vw] py-[0.7vw] border border-gray-300 text-center">
                            {isClaimedByMe ? (
                              <div className="flex flex-col items-center gap-[0.3vw]">
                                <input type="file" accept="image/*" onChange={(e) => handleImageChange(product._pid, product, e)} className="text-[0.6vw] w-[6vw]" />
                                {(draft.imagePreview || draft.image) && (
                                  <img src={draft.imagePreview || `${API_URL}${draft.image}`} alt="preview" className="w-[2vw] h-[2vw] object-cover border border-gray-300 rounded cursor-pointer" onClick={() => window.open(draft.imagePreview || `${API_URL}${draft.image}`, '_blank')} />
                                )}
                              </div>
                            ) : (
                              product.report?.image ? (
                                <img src={`${API_URL}${product.report.image}`} alt="preview" className="w-[2vw] h-[2vw] object-cover mx-auto border border-gray-300 rounded cursor-pointer" onClick={() => window.open(`${API_URL}${product.report.image}`, '_blank')} />
                              ) : <span className="text-[0.75vw] text-gray-400">—</span>
                            )}
                          </td>

                          {/* Info */}
                          <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-300">
                             <button 
                               onClick={() => setInfoSelected({ entry, product })}
                               className="w-[1.8vw] h-[1.8vw] rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all cursor-pointer shadow-sm border border-blue-100 mx-auto"
                               title="View Details"
                             >
                               <Eye className="w-[0.9vw] h-[0.9vw]" />
                             </button>
                          </td>

                          {/* Action */}
                          <td className="px-[0.8vw] py-[0.7vw] text-center border border-gray-300 bg-white sticky right-0 z-10 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                            {product.assignedTo ? (
                              isClaimedByMe ? (
                                <button
                                  onClick={() => saveRow(entry, product, draft)}
                                  disabled={!draft?.hasChanges}
                                  className={`inline-flex items-center gap-[0.25vw] px-[0.7vw] py-[0.35vw] rounded-[0.35vw] text-[0.85vw] font-semibold transition-all ${draft?.hasChanges ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-md" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
                                >
                                  <Send className="w-[0.75vw] h-[0.75vw]" />
                                  Save
                                </button>
                              ) : (
                                <div className="flex flex-col items-center gap-[0.2vw]">
                                  <Badge label="Claimed" color="slate" size="xs" />
                                  <span className="text-[0.6vw] text-gray-800 font-bold whitespace-nowrap">{product.assignedToName}</span>
                                </div>
                              )
                            ) : (
                              <ClaimButton onClaim={() => claimProduct(entry.id, product._pid)} />
                            )}
                          </td>
"""
    
    content = re.sub(tr_start + r".*?(?=                        </motion\.tr>)", new_tr, content, flags=re.DOTALL)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

process()
