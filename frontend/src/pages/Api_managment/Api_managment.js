import React from "react";
import "./Api_managment.css";
const ApiManagement = () => {
  return (
    <div className="api-mgmt-container">
      <h2>API Management</h2>
      <div className="api-section" style={{ display: 'grid', gap: '16px' }}>
        <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: '1fr 1fr' }}>
          <input className="api-input" placeholder="API Key" />
          <select className="api-select" defaultValue="Production">
            <option>Production</option>
            <option>Staging</option>
            <option>Development</option>
          </select>
        </div>
        <textarea className="api-textarea" rows="4" placeholder="Notes or description"></textarea>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="api-btn">Save</button>
          <button className="api-btn">Reset</button>
        </div>
      </div>
    </div>
  )
}
export default ApiManagement;