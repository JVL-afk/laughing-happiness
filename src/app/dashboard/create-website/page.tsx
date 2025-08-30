'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface WebsiteData {
  id: string;
  title: string;
  headline: string;
  description: string;
  html: string;
  css: string;
  features: string[];
  cta: string;
  seoKeywords: string[];
  productUrl: string;
  createdAt: string;
}

export default function CreateWebsite() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generatedWebsite, setGeneratedWebsite] = useState<WebsiteData | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    productUrl: '',
    niche: '',
    targetAudience: '',
    customization: {
      colorScheme: 'modern',
      style: 'professional',
      tone: 'persuasive'
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('customization.')) {
      const customizationField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        customization: {
          ...prev.customization,
          [customizationField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const validateForm = () => {
    if (!formData.productUrl) {
      setError('Product/Affiliate URL is required');
      return false;
    }

    // Validate URL format
    try {
      new URL(formData.productUrl);
    } catch {
      setError('Please enter a valid URL');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Get auth token (same as analyze-website)
      const token = localStorage.getItem('authToken') || 
                    localStorage.getItem('token') ||
                    document.cookie
                      .split('; ')
                      .find(row => row.startsWith('auth-token='))
                      ?.split('=')[1] ||
                    document.cookie
                      .split('; ')
                      .find(row => row.startsWith('token='))
                      ?.split('=')[1];

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Prepare request data
      const requestData = {
        productUrl: formData.productUrl.trim(),
        niche: formData.niche.trim() || undefined,
        targetAudience: formData.targetAudience.trim() || undefined,
        customization: formData.customization
      };

      console.log('Sending request:', requestData);

      const response = await fetch('/api/ai/generate-website', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      console.log('Response:', data);

      if (response.ok) {
        setSuccess('Website generated successfully! 🎉');
        setGeneratedWebsite(data.website);
        
        // Reset form
        setFormData({
          productUrl: '',
          niche: '',
          targetAudience: '',
          customization: {
            colorScheme: 'modern',
            style: 'professional',
            tone: 'persuasive'
          }
        });

      } else {
        setError(data.message || data.error || 'Failed to generate website');
        
        if (data.upgradeRequired) {
          // Show upgrade prompt
          setTimeout(() => {
            router.push('/pricing');
          }, 3000);
        }
      }

    } catch (error) {
      console.error('Error generating website:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (generatedWebsite) {
      // Open preview in new tab
      const previewWindow = window.open('', '_blank');
      if (previewWindow) {
        previewWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${generatedWebsite.title}</title>
              <style>${generatedWebsite.css}</style>
            </head>
            <body>
              ${generatedWebsite.html}
            </body>
          </html>
        `);
        previewWindow.document.close();
      }
    }
  };

  const handleSave = async () => {
    if (!generatedWebsite) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/websites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          websiteData: generatedWebsite
        }),
      });

      if (response.ok) {
        setSuccess('Website saved successfully! 🎉');
        router.push('/dashboard/my-websites');
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to save website');
      }
    } catch (error) {
      console.error('Error saving website:', error);
      setError('Failed to save website');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🚀 AI Website Generator
          </h1>
          <p className="text-xl text-gray-300">
            Generate high-converting affiliate websites with AI in seconds
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded-lg mb-6">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-100 px-4 py-3 rounded-lg mb-6">
            ✅ {success}
          </div>
        )}

        {/* Website Generation Form */}
        {!generatedWebsite && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Product URL */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Product/Affiliate URL *
                </label>
                <input
                  type="url"
                  name="productUrl"
                  value={formData.productUrl}
                  onChange={handleInputChange}
                  placeholder="https://example.com/product"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Niche */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Niche (Optional )
                </label>
                <input
                  type="text"
                  name="niche"
                  value={formData.niche}
                  onChange={handleInputChange}
                  placeholder="e.g., fitness, technology, beauty"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Target Audience (Optional)
                </label>
                <textarea
                  name="targetAudience"
                  value={formData.targetAudience}
                  onChange={handleInputChange}
                  placeholder="Describe your target audience..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Customization Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Color Scheme
                  </label>
                  <select
                    name="customization.colorScheme"
                    value={formData.customization.colorScheme}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="modern">Modern</option>
                    <option value="classic">Classic</option>
                    <option value="vibrant">Vibrant</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Style
                  </label>
                  <select
                    name="customization.style"
                    value={formData.customization.style}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="luxury">Luxury</option>
                    <option value="playful">Playful</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Tone
                  </label>
                  <select
                    name="customization.tone"
                    value={formData.customization.tone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="persuasive">Persuasive</option>
                    <option value="informative">Informative</option>
                    <option value="friendly">Friendly</option>
                    <option value="authoritative">Authoritative</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Generating Website...
                  </div>
                ) : (
                  '🚀 Generate Website'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Generated Website Preview */}
        {generatedWebsite && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                🎉 Website Generated Successfully!
              </h2>
              <p className="text-gray-300">
                Your affiliate website is ready. Preview it below or save it to your dashboard.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={handlePreview}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                👁️ Preview Website
              </button>
              <button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                💾 Save Website
              </button>
            </div>

            <div className="bg-black/20 rounded-lg p-4">
              <h3 className="text-white font-bold mb-2">Website Details:</h3>
              <div className="text-gray-300 space-y-1">
                <p><strong>Title:</strong> {generatedWebsite.title}</p>
                <p><strong>Headline:</strong> {generatedWebsite.headline}</p>
                <p><strong>Features:</strong> {generatedWebsite.features?.join(', ')}</p>
              </div>
            </div>

            <button
              onClick={() => {
                setGeneratedWebsite(null);
                setSuccess('');
              }}
              className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              🔄 Generate Another Website
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

