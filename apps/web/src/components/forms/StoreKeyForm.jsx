import { useState } from 'react';
import Button from '../ui/Button';

export default function StoreKeyForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    provider: 'anthropic',
    environment: 'production',
    rawKey: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="vault-label">Key Name</label>
        <input 
          type="text" 
          className="vault-input"
          placeholder="e.g. Anthropic Prod Core"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="vault-label">Provider</label>
          <select 
             className="vault-input"
             value={formData.provider}
             onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
             required
           >
             <optgroup label="AI/ML">
               <option value="anthropic">Anthropic</option>
               <option value="openai">OpenAI</option>
               <option value="gemini">Gemini</option>
               <option value="groq">Groq</option>
               <option value="huggingface">Hugging Face</option>
             </optgroup>
             <optgroup label="Version Control">
               <option value="github">GitHub</option>
               <option value="gitlab">GitLab</option>
             </optgroup>
             <optgroup label="Cloud Providers">
               <option value="aws">AWS</option>
               <option value="azure">Azure</option>
               <option value="gcp">Google Cloud</option>
             </optgroup>
             <optgroup label="Databases">
               <option value="supabase">Supabase</option>
               <option value="planetscale">PlanetScale</option>
               <option value="mongodb">MongoDB Cloud</option>
             </optgroup>
             <optgroup label="Platform">
               <option value="vercel">Vercel</option>
               <option value="cloudflare">Cloudflare</option>
               <option value="railway">Railway</option>
               <option value="custom">Custom</option>
             </optgroup>
           </select>
        </div>
        <div>
          <label className="vault-label">Environment</label>
          <select 
            className="vault-input"
            value={formData.environment}
            onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
            required
          >
            <option value="production">Production</option>
            <option value="preview">Preview</option>
            <option value="development">Development</option>
          </select>
        </div>
      </div>

      <div>
        <label className="vault-label">Raw API Key</label>
        <input 
          type="password" 
          className="vault-input font-mono"
          placeholder="sk-..."
          value={formData.rawKey}
          onChange={(e) => setFormData({ ...formData, rawKey: e.target.value })}
          required
        />
        <p className="text-[0.7rem] text-vault-text-muted mt-1.5">
          This key will be encrypted with AES-256-GCM before storage. It will never be stored in plaintext.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-vault-border mt-6">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit">Store in Vault</Button>
      </div>
    </form>
  );
}
