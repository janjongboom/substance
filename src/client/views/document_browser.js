var DocumentBrowser = Backbone.View.extend({
  events: {
    'click a.add-criterion': 'addCriterion',
    'click a.remove-criterion': 'removeCriterion'
  },
  
  addCriterion: function(e) {
    var property = $(e.currentTarget).attr('property'),
        operator = $(e.currentTarget).attr('operator'),
        value = $(e.currentTarget).attr('value');
    
    this.applyCommand({command: 'add_criterion', options: {
      property: property,
      operator: operator,
      value: value
    }});
    this.render();
    return false;
  },
  
  removeCriterion: function(e) {
    var property = $(e.currentTarget).attr('property'),
        operator = $(e.currentTarget).attr('operator'),
        value = $(e.currentTarget).attr('value');

    this.applyCommand({command: 'remove_criterion', options: {
      property: property,
      operator: operator,
      value: value
    }});
    this.render();
    return false;
  },
  
  initialize: function(options) {
    var that = this;
    
    that.commands = [];
    this.load();
    this.documentType = "/type/document"; // default type (= all documents)
  },
  
  load: function() {
    var that = this;
    graph.fetch({"type|=": ["/type/document"]}, {expand: false}, function(err, g) {
      if (err) alert('An error occured during fetching the documents');
      
      // Initialize Facets View
      that.facets = new Facets({el: '#facets', browser: that});
      that.render();
    });
  },
  
  render: function() {
    var that = this;
    
    // TODO: use this.options.query here
    var documents = graph.find({'type|=': this.documentType}).toArray();
    
    _.each(documents, function(doc) {
      doc.username = doc.value.data.creator.split('/')[2]
      doc.last_modified = _.prettyDate(new Date(doc.value.get('updated_at')).toJSON())
      doc.status = doc.value.get('published_on') ? 'published' : 'draft';
      doc.document_type = doc.value.type.key.split('/')[2];
    });
    
    var DESC_BY_UPDATED_AT = function(item1, item2) {
      var v1 = item1.value.get('updated_at'),
          v2 = item2.value.get('updated_at');
      return v1 === v2 ? 0 : (v1 > v2 ? -1 : 1);
    };
    
    documents = documents.sort(DESC_BY_UPDATED_AT);
    
    var documentTypes = [{
      name: "Aktuell",
      type: "/type/document",
      selected: "/type/document" === that.documentType
    }];
    
    graph.get('/config/substance').get('document_types').each(function(type, key) {
      var name;
      if (type === '/type/conversation') name = 'Gespräche';
      if (type === '/type/story') name = 'Geschichten';
      documentTypes.push({
        name: name,
        type: type,
        selected: type === that.documentType
      });
    });
    
    $(this.el).html(_.renderTemplate('document_browser', {
      num_documents: documents.length,
      documents: documents,
      document_types: documentTypes
    }));
    
    this.facets.render();
  },
  
  // Takes a command spec and applies the command
  applyCommand: function(spec) {
    var cmd;
    
    if (spec.command === 'add_criterion') {
      cmd = new AddCriterion(this, spec.options);
    } else if (spec.command === 'remove_criterion') {
      cmd = new RemoveCriterion(this, spec.options);
    }

    // remove follow-up commands (redo-able commands)
    if (this.currentCommand < this.commands.length-1) {
      this.commands.splice(this.currentCommand+1);
    }

    // insertion position
    var pos = undefined;
    $.each(this.commands, function(index, c) {
      if (c.matchesInverse(cmd)) {
        pos = index;
      }
    });

    if (pos >= 0) {
      // restore state
      this.commands[pos].unexecute();
      // remove matched inverse command
      this.commands.splice(pos, 1);
      // execute all follow-up commands [pos..this.commands.length-1]
      for (var i=pos; i < this.commands.length; i++) {
        this.commands[i].execute();
      }
    } else {
      this.commands.push(cmd);
      cmd.execute();
    }

    this.currentCommand = this.commands.length-1;
    return cmd;
  },
  
  undo: function() {
    if (this.currentCommand >= 0) {
      this.commands[this.currentCommand].unexecute();
      this.currentCommand -= 1;
      this.render();    
    }
  },

  redo: function() {
    if (this.currentCommand < this.commands.length-1) {
      this.currentCommand += 1;
      this.commands[this.currentCommand].execute();
      this.render();    
    }
  }
});