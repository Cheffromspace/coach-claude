import { useState, useEffect } from 'react';
import { useMCPResource } from '../../mcp/hooks/useMCPResource';
import { ResourceContent } from '../../mcp/types';

interface ResourcePreviewProps {
  uri: string;
}

export function ResourcePreview({ uri }: ResourcePreviewProps) {
  const { loading, error, getResourceContent } = useMCPResource();
  const [content, setContent] = useState<ResourceContent | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const resourceContent = await getResourceContent(uri);
        setContent(resourceContent);
      } catch (err) {
        console.error('Error fetching resource content:', err);
      }
    };

    fetchContent();
  }, [uri, getResourceContent]);

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="space-y-3 mt-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        Failed to load resource: {error.message}
      </div>
    );
  }

  if (!content) {
    return null;
  }

  // Handle different mime types
  switch (content.mimeType) {
    case 'text/markdown':
    case 'text/plain':
      return (
        <div className="p-4 bg-gray-50 rounded-lg">
          <pre className="whitespace-pre-wrap font-mono text-sm">
            {content.text}
          </pre>
        </div>
      );

    case 'application/json':
      try {
        const jsonData = JSON.parse(content.text);
        return (
          <div className="p-4 bg-gray-50 rounded-lg">
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {JSON.stringify(jsonData, null, 2)}
            </pre>
          </div>
        );
      } catch {
        return (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">
            Invalid JSON content
          </div>
        );
      }

    default:
      return (
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-gray-500">
            Preview not available for type: {content.mimeType}
          </div>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-sm">
            {content.text}
          </pre>
        </div>
      );
  }
}
