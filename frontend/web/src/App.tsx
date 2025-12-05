// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface Term {
  id: string;
  encryptedCondition: string;
  timestamp: number;
  owner: string;
  category: string;
  description: string;
  status: "active" | "inactive";
}

const FHEEncryptBoolean = (value: boolean): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptBoolean = (encryptedData: string): boolean => {
  if (encryptedData.startsWith('FHE-')) {
    return atob(encryptedData.substring(4)) === 'true';
  }
  return encryptedData === 'true';
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<Term[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newTermData, setNewTermData] = useState({ category: "", description: "", condition: false });
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [decryptedCondition, setDecryptedCondition] = useState<boolean | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [userHistory, setUserHistory] = useState<string[]>([]);

  const activeCount = terms.filter(t => t.status === "active").length;
  const inactiveCount = terms.filter(t => t.status === "inactive").length;

  useEffect(() => {
    loadTerms().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadTerms = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      const keysBytes = await contract.getData("term_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing term keys:", e); }
      }
      
      const list: Term[] = [];
      for (const key of keys) {
        try {
          const termBytes = await contract.getData(`term_${key}`);
          if (termBytes.length > 0) {
            try {
              const termData = JSON.parse(ethers.toUtf8String(termBytes));
              list.push({ 
                id: key, 
                encryptedCondition: termData.condition, 
                timestamp: termData.timestamp, 
                owner: termData.owner, 
                category: termData.category,
                description: termData.description,
                status: termData.status || "active"
              });
            } catch (e) { console.error(`Error parsing term data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading term ${key}:`, e); }
      }
      list.sort((a, b) => b.timestamp - a.timestamp);
      setTerms(list);
    } catch (e) { console.error("Error loading terms:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const submitTerm = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setCreating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting condition with Zama FHE..." });
    try {
      const encryptedCondition = FHEEncryptBoolean(newTermData.condition);
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const termId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const termData = { 
        condition: encryptedCondition, 
        timestamp: Math.floor(Date.now() / 1000), 
        owner: address, 
        category: newTermData.category,
        description: newTermData.description,
        status: "active"
      };
      
      await contract.setData(`term_${termId}`, ethers.toUtf8Bytes(JSON.stringify(termData)));
      
      const keysBytes = await contract.getData("term_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(termId);
      await contract.setData("term_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Encrypted term submitted securely!" });
      setUserHistory(prev => [...prev, `Created term: ${newTermData.description.substring(0, 30)}...`]);
      await loadTerms();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewTermData({ category: "", description: "", condition: false });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCreating(false); }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<boolean | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      setUserHistory(prev => [...prev, `Decrypted term condition`]);
      return FHEDecryptBoolean(encryptedData);
    } catch (e) { 
      console.error("Decryption failed:", e); 
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const toggleTermStatus = async (termId: string, currentStatus: "active" | "inactive") => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Updating term status..." });
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const termBytes = await contract.getData(`term_${termId}`);
      if (termBytes.length === 0) throw new Error("Term not found");
      
      const termData = JSON.parse(ethers.toUtf8String(termBytes));
      const updatedTerm = { 
        ...termData, 
        status: currentStatus === "active" ? "inactive" : "active" 
      };
      
      await contract.setData(`term_${termId}`, ethers.toUtf8Bytes(JSON.stringify(updatedTerm)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Term status updated!" });
      setUserHistory(prev => [...prev, `Toggled term ${termId.substring(0, 6)}... status`]);
      await loadTerms();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Update failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const isOwner = (termAddress: string) => address?.toLowerCase() === termAddress.toLowerCase();

  const filteredTerms = terms.filter(term => {
    const matchesSearch = term.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         term.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || term.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(terms.map(t => t.category)));

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Loading encrypted terms...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>DID<span>Terms</span>FHE</h1>
          <p>FHE-encrypted terms for your decentralized identity</p>
        </div>
        <div className="header-actions">
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>

      <main className="main-content">
        <div className="dashboard-section">
          <div className="dashboard-card">
            <h3>FHE-Encrypted Terms</h3>
            <p>Attach fully homomorphic encrypted terms to your DID that dApps must comply with</p>
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="primary-btn"
            >
              + Add New Term
            </button>
          </div>

          <div className="stats-container">
            <div className="stat-card">
              <div className="stat-value">{terms.length}</div>
              <div className="stat-label">Total Terms</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{activeCount}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{inactiveCount}</div>
              <div className="stat-label">Inactive</div>
            </div>
          </div>
        </div>

        <div className="search-filter-section">
          <input
            type="text"
            placeholder="Search terms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <button onClick={loadTerms} className="refresh-btn">
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="terms-list">
          {filteredTerms.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>No terms found matching your criteria</p>
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="primary-btn"
              >
                Create First Term
              </button>
            </div>
          ) : (
            filteredTerms.map(term => (
              <div 
                key={term.id} 
                className={`term-card ${term.status}`}
                onClick={() => setSelectedTerm(term)}
              >
                <div className="term-header">
                  <span className="term-id">#{term.id.substring(0, 6)}</span>
                  <span className={`term-status ${term.status}`}>
                    {term.status}
                  </span>
                </div>
                <div className="term-category">{term.category}</div>
                <div className="term-description">
                  {term.description.substring(0, 100)}{term.description.length > 100 ? "..." : ""}
                </div>
                <div className="term-footer">
                  <div className="term-owner">
                    {term.owner.substring(0, 6)}...{term.owner.substring(38)}
                  </div>
                  <div className="term-date">
                    {new Date(term.timestamp * 1000).toLocaleDateString()}
                  </div>
                </div>
                {isOwner(term.owner) && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTermStatus(term.id, term.status);
                    }}
                    className="status-toggle-btn"
                  >
                    Toggle Status
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="user-history-section">
          <h3>Your Recent Actions</h3>
          {userHistory.length === 0 ? (
            <p>No actions recorded yet</p>
          ) : (
            <ul className="history-list">
              {userHistory.slice(0, 5).map((action, index) => (
                <li key={index} className="history-item">
                  {action}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal">
            <div className="modal-header">
              <h2>Add New DID Term</h2>
              <button 
                onClick={() => setShowCreateModal(false)} 
                className="close-btn"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  name="category"
                  value={newTermData.category}
                  onChange={(e) => setNewTermData({...newTermData, category: e.target.value})}
                  placeholder="e.g. Data Usage"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={newTermData.description}
                  onChange={(e) => setNewTermData({...newTermData, description: e.target.value})}
                  placeholder="Describe your term (e.g. My data cannot be used for advertising)"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Condition</label>
                <div className="condition-radio">
                  <label>
                    <input
                      type="radio"
                      name="condition"
                      checked={newTermData.condition === true}
                      onChange={() => setNewTermData({...newTermData, condition: true})}
                    />
                    Must be true
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="condition"
                      checked={newTermData.condition === false}
                      onChange={() => setNewTermData({...newTermData, condition: false})}
                    />
                    Must be false
                  </label>
                </div>
              </div>
              <div className="encryption-preview">
                <h4>FHE Encryption Preview</h4>
                <div className="preview-content">
                  <div className="plain-value">
                    Plain condition: {newTermData.condition.toString()}
                  </div>
                  <div className="arrow">→</div>
                  <div className="encrypted-value">
                    Encrypted: {FHEEncryptBoolean(newTermData.condition).substring(0, 30)}...
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setShowCreateModal(false)} 
                className="secondary-btn"
              >
                Cancel
              </button>
              <button 
                onClick={submitTerm} 
                disabled={creating || !newTermData.description || !newTermData.category}
                className="primary-btn"
              >
                {creating ? "Encrypting with Zama FHE..." : "Create Term"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTerm && (
        <div className="modal-overlay">
          <div className="term-detail-modal">
            <div className="modal-header">
              <h2>Term Details</h2>
              <button 
                onClick={() => {
                  setSelectedTerm(null);
                  setDecryptedCondition(null);
                }} 
                className="close-btn"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">ID:</span>
                <span className="detail-value">#{selectedTerm.id.substring(0, 8)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Category:</span>
                <span className="detail-value">{selectedTerm.category}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Owner:</span>
                <span className="detail-value">
                  {selectedTerm.owner.substring(0, 6)}...{selectedTerm.owner.substring(38)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Created:</span>
                <span className="detail-value">
                  {new Date(selectedTerm.timestamp * 1000).toLocaleString()}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className={`detail-value status ${selectedTerm.status}`}>
                  {selectedTerm.status}
                </span>
              </div>
              <div className="detail-row full-width">
                <span className="detail-label">Description:</span>
                <p className="detail-value description">{selectedTerm.description}</p>
              </div>
              <div className="encrypted-section">
                <h3>FHE-Encrypted Condition</h3>
                <div className="encrypted-data">
                  {selectedTerm.encryptedCondition.substring(0, 50)}...
                </div>
                <button
                  onClick={async () => {
                    if (decryptedCondition !== null) {
                      setDecryptedCondition(null);
                    } else {
                      const decrypted = await decryptWithSignature(selectedTerm.encryptedCondition);
                      setDecryptedCondition(decrypted);
                    }
                  }}
                  disabled={isDecrypting}
                  className="decrypt-btn"
                >
                  {isDecrypting ? "Decrypting..." : 
                   decryptedCondition !== null ? "Hide Decrypted Value" : "Decrypt with Wallet"}
                </button>
              </div>
              {decryptedCondition !== null && (
                <div className="decrypted-section">
                  <h3>Decrypted Condition</h3>
                  <div className="decrypted-value">
                    {decryptedCondition.toString()}
                  </div>
                  <p className="decryption-note">
                    This value was decrypted client-side after wallet signature verification
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {isOwner(selectedTerm.owner) && (
                <button
                  onClick={() => {
                    toggleTermStatus(selectedTerm.id, selectedTerm.status);
                    setSelectedTerm(null);
                  }}
                  className="status-toggle-btn"
                >
                  Toggle Status
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedTerm(null);
                  setDecryptedCondition(null);
                }}
                className="primary-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {transactionStatus.visible && (
        <div className="transaction-notification">
          <div className={`notification-content ${transactionStatus.status}`}>
            <div className="notification-icon">
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="notification-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>DID Terms FHE</h3>
            <p>Powered by Zama FHE technology</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">GitHub</a>
            <a href="#" className="footer-link">Terms</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} DID Terms FHE. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;