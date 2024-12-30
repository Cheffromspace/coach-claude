import { readNote } from "../../utils.js";
import { getMarkdownFiles } from "./query-engine.js";
import path from "path";
import fs from "fs/promises";

interface TagRelationship {
  relatedTag: string;
  type: 'similar' | 'opposite' | 'broader' | 'narrower' | 'custom';
  strength?: number;
}

interface TagNode {
  name: string;
  parent?: string;
  children: Set<string>;
  files: Set<string>;
  relationships: Map<string, TagRelationship>; // Map of relatedTag to relationship details
}

export class TagManager {
  private tagIndex: Map<string, TagNode>;
  private initialized: boolean;

  constructor() {
    this.tagIndex = new Map();
    this.initialized = false;
  }

  addTagRelationship(tag: string, relatedTag: string, type: TagRelationship['type'], strength?: number) {
    const normalizedTag = this.normalizeTag(tag);
    const normalizedRelatedTag = this.normalizeTag(relatedTag);

    // Create nodes if they don't exist
    if (!this.tagIndex.has(normalizedTag)) {
      this.tagIndex.set(normalizedTag, {
        name: tag,
        children: new Set(),
        files: new Set(),
        relationships: new Map()
      });
    }

    if (!this.tagIndex.has(normalizedRelatedTag)) {
      this.tagIndex.set(normalizedRelatedTag, {
        name: relatedTag,
        children: new Set(),
        files: new Set(),
        relationships: new Map()
      });
    }

    // Add bidirectional relationships
    const tagNode = this.tagIndex.get(normalizedTag)!;
    const relatedNode = this.tagIndex.get(normalizedRelatedTag)!;

    tagNode.relationships.set(normalizedRelatedTag, {
      relatedTag,
      type,
      strength
    });

    // Add inverse relationship
    const inverseType = this.getInverseRelationType(type);
    relatedNode.relationships.set(normalizedTag, {
      relatedTag: tag,
      type: inverseType,
      strength
    });
  }

  private getInverseRelationType(type: TagRelationship['type']): TagRelationship['type'] {
    switch (type) {
      case 'broader': return 'narrower';
      case 'narrower': return 'broader';
      case 'opposite': return 'opposite';
      default: return type; // similar and custom remain the same
    }
  }

  getTagRelationships(tag: string): TagRelationship[] {
    const normalizedTag = this.normalizeTag(tag);
    const node = this.tagIndex.get(normalizedTag);
    return node ? Array.from(node.relationships.values()) : [];
  }

  private normalizeTag(tag: string, caseSensitive: boolean = false): string {
    return caseSensitive ? tag : tag.toLowerCase();
  }

  async initialize(vaultRoot: string) {
    if (this.initialized) return;

    try {
      const files = await getMarkdownFiles(vaultRoot, vaultRoot);
      
      for (const file of files) {
        const relativePath = path.relative(vaultRoot, file);
        const content = await readNote(file);
        
        // Extract tags from frontmatter and metadata
        const tags = new Set<string>();
        
        // Direct tags
        if (content.frontmatter?.tags) {
          content.frontmatter.tags.forEach((tag: string) => tags.add(tag));
        }
        
        // Tags in metadata
        if (content.frontmatter?.metadata?.tags) {
          content.frontmatter.metadata.tags.forEach((tag: string) => tags.add(tag));
        }

        // Index each tag
        tags.forEach(tag => {
          const normalizedTag = this.normalizeTag(tag);
          if (!this.tagIndex.has(normalizedTag)) {
      this.tagIndex.set(normalizedTag, {
        name: tag,
        children: new Set(),
        files: new Set(),
        relationships: new Map()
      });
          }
          this.tagIndex.get(normalizedTag)!.files.add(relativePath);
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize tag index:", error);
      throw error;
    }
  }

  setTagHierarchy(tag: string, parent?: string, children: string[] = []) {
    const normalizedTag = this.normalizeTag(tag);
    const normalizedParent = parent ? this.normalizeTag(parent) : undefined;
    const normalizedChildren = children.map(child => this.normalizeTag(child));

    // Create or update tag node
    if (!this.tagIndex.has(normalizedTag)) {
      this.tagIndex.set(normalizedTag, {
        name: tag,
        children: new Set(),
        files: new Set(),
        relationships: new Map()
      });
    }

    const tagNode = this.tagIndex.get(normalizedTag)!;

    // Update parent relationship
    if (normalizedParent) {
      if (!this.tagIndex.has(normalizedParent)) {
      this.tagIndex.set(normalizedParent, {
        name: parent!,
        children: new Set([normalizedTag]),
        files: new Set(),
        relationships: new Map()
      });
      } else {
        this.tagIndex.get(normalizedParent)!.children.add(normalizedTag);
      }
      tagNode.parent = normalizedParent;
    }

    // Update children relationships
    normalizedChildren.forEach(child => {
      if (!this.tagIndex.has(child)) {
        this.tagIndex.set(child, {
          name: children[normalizedChildren.indexOf(child)],
          parent: normalizedTag,
          children: new Set(),
          files: new Set(),
          relationships: new Map()
        });
      } else {
        this.tagIndex.get(child)!.parent = normalizedTag;
      }
      tagNode.children.add(child);
    });
  }

  private getAllChildTags(tag: string, caseSensitive: boolean = false): Set<string> {
    const normalizedTag = this.normalizeTag(tag, caseSensitive);
    const allChildren = new Set<string>();
    
    const addChildren = (currentTag: string) => {
      const node = this.tagIndex.get(currentTag);
      if (!node) return;
      
      node.children.forEach(child => {
        allChildren.add(child);
        addChildren(child);
      });
    };
    
    addChildren(normalizedTag);
    return allChildren;
  }

  searchByTags(tags: string[], operator: 'AND' | 'OR' = 'AND', includeChildren: boolean = false, caseSensitive: boolean = false): string[] {
    const normalizedTags = tags.map(tag => this.normalizeTag(tag, caseSensitive));
    const fileSets: Set<string>[] = [];

    normalizedTags.forEach(tag => {
      const tagFiles = new Set<string>();
      const node = this.tagIndex.get(tag);
      
      if (node) {
        // Add files with the exact tag
        node.files.forEach(file => tagFiles.add(file));

        // Add files with child tags if requested
        if (includeChildren) {
          const childTags = this.getAllChildTags(tag, caseSensitive);
          childTags.forEach(childTag => {
            const childNode = this.tagIndex.get(childTag);
            if (childNode) {
              childNode.files.forEach(file => tagFiles.add(file));
            }
          });
        }
      }
      
      fileSets.push(tagFiles);
    });

    if (fileSets.length === 0) return [];

    let resultSet = fileSets[0];
    
    for (let i = 1; i < fileSets.length; i++) {
      if (operator === 'AND') {
        resultSet = new Set([...resultSet].filter(file => fileSets[i].has(file)));
      } else { // OR
        fileSets[i].forEach(file => resultSet.add(file));
      }
    }

    return Array.from(resultSet).sort();
  }

  getTagHierarchy(tag: string): { parent?: string; children: string[] } {
    const normalizedTag = this.normalizeTag(tag);
    const node = this.tagIndex.get(normalizedTag);
    
    if (!node) {
      return { children: [] };
    }

    return {
      parent: node.parent,
      children: Array.from(node.children)
    };
  }

  getAllTags(): { name: string; count: number }[] {
    return Array.from(this.tagIndex.entries())
      .map(([_, node]) => ({
        name: node.name,
        count: node.files.size
      }))
      .sort((a, b) => b.count - a.count);
  }
}
