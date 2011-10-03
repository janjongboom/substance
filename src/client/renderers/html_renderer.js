var renderControls = function(node, first, last, parent, level) {
  
  function render(node, destination, consolidate) {
    var actions = new Data.Hash();
    var innerNode = null;
    var path = [];
    
    // Ensure correct order
    actions.set('/type/section', []);
    actions.set('/type/text', []);
    actions.set('/type/image', []);
    actions.set('/type/resource', []);
    actions.set('/type/quote', []);
    actions.set('/type/code', []);
    actions.set('/type/gist', []);
    
    function computeActions(n, parent) {
      function registerAction(action) {
        if (action.nodeType === '/type/section' && action.level > 3) return;
        // if (actions.get(action.nodeType)) {
        if (action.nodeType === '/type/section') {
          var SORT_BY_LEVEL = function(v1, v2) {
            return v1.level === v2.level ? 0 : (v1.level < v2.level ? -1 : 1);
          }
          var choices = actions.get(action.nodeType);
          choices.push(action);
          choices.sort(SORT_BY_LEVEL);
          actions.set(action.nodeType, choices);
        } else if (!actions.get(action.nodeType)[0] || action.level > actions.get(action.nodeType)[0].level) {
          // Always use deepest level for leave nodes!
          actions.set(action.nodeType, [action]);
        }
      }
      
      var nlevel = parseInt($('#'+n.html_id).attr('level'));
      innerNode = n;
      n.level = nlevel;
      if (nlevel<=3) path.push(n);
      
      // Possible children
      if (n.all('children') && n.all('children').length === 0 && destination === 'after') {
        var children = n.properties().get('children').expectedTypes;
        
        _.each(children, function(type) {
          registerAction({
            node: n._id,
            parentNode: parent ? parent._id : null,
            nodeType: type,
            nodeTypeName: graph.get(type).name,
            insertionType: 'child',
            level: nlevel+1
          });
        });
      }

      // Possible siblings
      if (parent) {
        var siblings = parent.properties().get('children').expectedTypes;
        _.each(siblings, function(type) {
          registerAction({
            node: n._id,
            parentNode: parent ? parent._id : null,
            nodeType: type,
            nodeTypeName: graph.get(type).name,
            insertionType: 'sibling',
            level: nlevel
          });
        });
      }
      
      // Consolidate actions for child elements
      if (consolidate && n.all('children') && n.all('children').length > 0) {
        computeActions(n.all('children').last(), n);
      }
      return actions;
    }
    computeActions(node, parent);
    
    // Move insertion type for leaf nodes
    var moveInsertionType = innerNode.all('children') && innerNode.all('children').length === 0 && destination === 'after' ? "child" : "sibling";
    
    return _.tpl('controls', {
      node: innerNode,
      insertion_type: moveInsertionType,
      destination: destination,
      actions: actions,
      path: path
    });
  }
  
  // Top level
  if (!parent) {
    // Cleanup
    $('#document .controls').remove();
    if (!node.all('children') || node.all('children').length === 0) {
      $(render(node, 'after')).appendTo($('#'+node.html_id));
    }
  } else {
    //  Insert before, but only for starting nodes (first=true)
    if (first) $(render(node, 'before')).insertBefore($('#'+node.html_id));
    
    if (!last || parent.types().get('/type/document')) {
      $(render(node, 'after', true)).insertAfter($('#'+node.html_id));
    }
  }
  
  if (node.all('children')) {
    // Do the same for all children
    node.all('children').each(function(child, key, index) {
      var first = index === 0;
      var last = index === node.all('children').length-1;
      renderControls(child, first, last, node, level + 1);
    });
  }
};

// HTMLRenderer
// ---------------

var HTMLRenderer = function(root, parent, lvl) {
  
  // Implement node types
  var renderers = {
    "/type/document": function(node, parent, level) {
      var content = '',
          children = node.all('children');
      
      if (children) {
        children.each(function(child, key, index) {
          if (!child.type) console.log(node._id+ "has an unreferenced child" + key);
          content += renderers[child.type._id](child, node, level+1);
        });
      }
      
      return _.tpl('document', {
        node: node,
        toc: new TOCRenderer(node).render(),
        content: content,
        edit: app.document.mode === 'edit',
        title: app.document.mode === 'edit' ? node.get('title') : node.get('title') || 'Untitled',
        lead: node.get('lead'),
        empty_lead: app.document.mode === 'edit' && (!node.get('lead') || node.get('lead') === ''),
        empty_title: app.document.mode === 'edit' && (!node.get('title') || node.get('title') === ''),
        level: level
      });
    },
    
    "/type/story": function(node, parent, level) {
      return renderers["/type/document"](node, parent, level)
    },
    
    "/type/conversation": function(node, parent, level) {
      return renderers["/type/document"](node, parent, level)
    },
    
    "/type/article": function(node, parent, level) {
      return renderers["/type/document"](node, parent, level)
    },
    
    "/type/manual": function(node, parent, level) {
      return renderers["/type/document"](node, parent, level)
    },
    
    "/type/qaa": function(node, parent, level) {
      return renderers["/type/document"](node, parent, level)
    },
    
    "/type/section": function(node, parent, level) {
      var content = '',
          children = node.all('children');
      
      if (children) {
        node.all('children').each(function(child, key, index) { 
          content += renderers[child.type._id](child, node, level+1);
        });
      }
      
      return Helpers.renderTemplate('section', {
        node: node,
        comments: node.get('comment_count'), // node.get('comments') && node.get('comments').length>0 ? node.get('comments').length : "",
        parent: parent,
        content: content,
        heading_level: level,
        level: level,
        edit: app.document.mode === 'edit',
        name: node.get('name'),
        empty: app.document.mode === 'edit' && (!node.get('name') || node.get('name') === '')
      });
    },
    
    "/type/text": function(node, parent, level) {
      return _.tpl('text', {
        node: node,
        comments: node.get('comment_count'), // node.get('comments') && node.get('comments').length>0 ? node.get('comments').length : "",
        parent: parent,
        edit: app.document.mode === 'edit',
        content: node.get('content'),
        empty: app.document.mode === 'edit' && (!node.get('content') || node.get('content') === '<p></p>'),
        level: level
      });
    },
    
    "/type/quote": function(node, parent, level) {
      return Helpers.renderTemplate('quote', {
        node: node,
        comments: node.get('comment_count'), // node.get('comments') && node.get('comments').length>0 ? node.get('comments').length : "",
        parent: parent,
        edit: app.document.mode === 'edit',
        content: node.get('content'),
        author: node.get('author'),
        empty_content: app.document.mode === 'edit' && (!node.get('content') || node.get('content') === ''),
        empty_author: app.document.mode === 'edit' && (!node.get('author') || node.get('author') === ''),
        level: level
      });
    },
    
    "/type/code": function(node, parent, level) {
      return Helpers.renderTemplate('code', {
        node: node,
        comments: node.get('comment_count'), // node.get('comments') && node.get('comments').length>0 ? node.get('comments').length : "",
        parent: parent,
        edit: app.document.mode === 'edit',
        content: node.get('content'),
        empty: app.document.mode === 'edit' && (!node.get('content') || node.get('content') === ''),
        level: level
      });
    },
    
    "/type/question": function(node, parent, level) {
      return Helpers.renderTemplate('question', {
        node: node,
        comments: node.get('comment_count'), // node.get('comments') && node.get('comments').length>0 ? node.get('comments').length : "",
        parent: parent,
        edit: app.document.mode === 'edit',
        content: node.get('content'),
        empty: app.document.mode === 'edit' && (!node.get('content') || node.get('content') === ''),
        level: level
      });
    },
    
    "/type/answer": function(node, parent, level) {
      return Helpers.renderTemplate('answer', {
        node: node,
        comments: node.get('comment_count'), // node.get('comments') && node.get('comments').length>0 ? node.get('comments').length : "",
        parent: parent,
        edit: app.document.mode === 'edit',
        content: node.get('content'),
        empty: app.document.mode === 'edit' && (!node.get('content') || node.get('content') === ''),
        level: level
      });
    },
    
    "/type/image": function(node, parent, level) {
      return _.tpl('image', {
        node: node,
        comments: node.get('comment_count'), // node.get('comments') && node.get('comments').length>0 ? node.get('comments').length : "",
        parent: parent,
        edit: app.document.mode === 'edit',
        url: node.get('url'),
        original_url: node.get('original_url'),
        level: level,
        empty: app.document.mode === 'edit' && (!node.get('caption') || node.get('caption') === ''),
        caption: node.get('caption'),
        transloadit_params: config.transloadit
      });
    },
    
    "/type/resource": function(node, parent, level) {
      return Helpers.renderTemplate('resource', {
        node: node,
        comments: node.get('comment_count'), // node.get('comments') && node.get('comments').length>0 ? node.get('comments').length : "",
        parent: parent,
        edit: app.document.mode === 'edit',
        url: node.get('url'),
        level: level,
        empty: app.document.mode === 'edit' && (!node.get('caption') || node.get('caption') === ''),
        caption: node.get('caption'),
        transloadit_params: config.transloadit
      });
    },
    
    "/type/visualization": function(node, parent, level) {
      return Helpers.renderTemplate('visualization', {
        node: node,
        comments: node.get('comment_count'), // node.get('comments') && node.get('comments').length>0 ? node.get('comments').length : "",
        parent: parent,
        edit: app.document.mode === 'edit',
        visualization_type: node.get('visualization_type'),
        data_source: node.get('data_source'),
        level: level
      });
    },
    
    "/type/gist": function(node, parent, level) {
      return Helpers.renderTemplate('gist', {
        node: node,
        comments: node.get('comment_count'), // node.get('comments') && node.get('comments').length>0 ? node.get('comments').length : "",
        parent: parent,
        edit: app.document.mode === 'edit',
        content: node.get('content'),
        empty: app.document.mode === 'edit' && (!node.get('content') || node.get('content') === ''),
        level: level
      });
    }
  };

  return {
    render: function() {
      // Traverse the document
      return renderers[root.type._id](root, parent, parseInt(lvl));
    }
  };
};


var TOCRenderer = function(root) {
  
  // Known node types
  var renderers = {
    "/type/document": function(node) {
      content = '<ol>';
      node.all('children').each(function(child) {
        if (child.type.key !== '/type/section') return;
        content += '<li><a class="toc-item" node="'+child.html_id+'" href="#'+root.get('creator')._id.split('/')[2]+'/'+root.get('name')+'/'+child.html_id+'">'+child.get('name')+'</a>';
        
        content += renderers["/type/document"](child);
        content += '</li>';
      });
      content += '</ol>';
      return content;
    },
    
    "/type/story": function(node) {
      return renderers["/type/document"](node);
    },
    
    "/type/conversation": function(node) {
      return "";
    },
    
    "/type/manual": function(node, parent) {
      return renderers["/type/document"](node, parent);
    },
    
    "/type/article": function(node, parent) {
      return renderers["/type/document"](node, parent);
    },
    
    "/type/qaa": function(node, parent) {
      return renderers["/type/document"](node, parent);
    }
  };

  return {
    render: function() {
      // Traverse the document
      return renderers[root.type._id](root);
    }
  };
};