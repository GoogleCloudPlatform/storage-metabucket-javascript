$(function() {

  var GCS_BASE_URL = 'https://www.googleapis.com/storage/v1beta1';
  var GCS_DOWNLOAD_URL = 'http://' + GCS_BUCKET + '.storage.googleapis.com';
  var metadata_xhr = null;
  var contents_xhr = null;

  function make_gcs_url(path, params) {
    var query_string = '?key=' + GCS_API_KEY;
    if (params != undefined) {
      for (prop in params) {
        query_string += '&' + prop + '=' + params[prop];
      }
    }
    return GCS_BASE_URL + path + query_string;
  };

  function display_name(s) {
    var i, pieces = s.split('/');
    for (i = pieces.length - 1; i >= 0; i--) {
      if (pieces[i].length > 0) {
        return pieces[i];
      }
    }
    return 'ERROR';
  };

  function convert_gcs_to_jstree(data) {
    var i, item, prefix, results = [];

    // Get directory prefixes
    if (data.prefixes !== undefined) {
      for (i = 0; i < data.prefixes.length; i++) {
        prefix = data.prefixes[i];
        results.push({'data': display_name(prefix),
                      'attr': {'gcs_id': prefix},
                      'state': 'closed'});
      }
    }

    // Get files in directory
    if (data.items !== undefined) {
      for (i = 0; i < data.items.length; i++) {
        item = data.items[i];
        results.push({'data': display_name(item.id),
                      'attr': {'gcs_id': item.name}});
      }
    }

    return results;
  };

  function data_fetch(node, data_callback) {
    if (node == -1) {
      $.ajax({
        url: make_gcs_url('/b/' + GCS_BUCKET + '/o', {'delimiter': '/'}),
        dataType: 'json',
        success: function(data, textStatus, xhr) {
          data_callback(convert_gcs_to_jstree(data));
        }
      });
    } else {
      $.ajax({
        url: make_gcs_url('/b/' + GCS_BUCKET + '/o',
          {'delimiter': '/',
           'prefix': node.attr('gcs_id')}),
        dataType: 'json',
        success: function(data, textStatus, xhr) {
        data_callback(convert_gcs_to_jstree(data));
        }
      });
    }
  };

  function fetch_contents() {
    var gcs_id, contents_url;
    $('#btn-fetch-file').attr('disabled', 'disabled');
    gcs_id = $.jstree._focused().get_selected().attr('gcs_id');
    if (contents_xhr != null) {
      contents_xhr.abort();
    }
    $('#file-contents').empty();
    $('#file-contents').html('Loading...');
    contents_url = GCS_DOWNLOAD_URL + '/' + gcs_id;
    contents_xhr = $.ajax({
      url: contents_url,
      dataType: 'text',
      beforeSend: function(xhr) {
        xhr.overrideMimeType('text/plain; charset=x-user-defined');
      },
      success: function(data, textStatus, xhr) {
        $('#file-contents').text(data);
      }
    });
  }

  function fill_metadata(data) {
    var dlstr = '<dl  class="dl-horizontal">';
    dlstr += '<dt>Content-Type</dt><dd>' + data.media.contentType + '</dd>';
    dlstr += '<dt>Hash</dt><dd>' + data.media.algorithm + ':' +
             data.media.hash + '</dd>';
    dlstr += '<dt>Length</dt><dd>' + data.media.length + '</dd>';
    dlstr += '<dt>Created</dt><dd>' + data.media.timeCreated + '</dd>';
    dlstr += '</dl><br/>';
    dlstr += '<center><button id="btn-fetch-file" class="btn btn-primary">' +
             'Fetch File</button></center>';
    $('#file-props').html(dlstr);
    $('#btn-fetch-file').bind('click', fetch_contents);
  }

  function node_clicked(event, data) {
    var node, gcs_id, metadata_url;
    if (metadata_xhr !== null) {
      metadata_xhr.abort();
    }
    $('#file-props').empty();
    $('#file-contents').empty();
    $('#file-props').html('Loading...');
    node = data.rslt.obj;
    gcs_id = node.attr('gcs_id');
    if (gcs_id.substr(gcs_id.length - 1) == '/') {
      $('#file-props').html('Prefixes don\'t have metadata.');
    }
    metadata_url = make_gcs_url('/b/' + GCS_BUCKET + '/o/' +
                                encodeURIComponent(gcs_id), {'alt': 'json'});
    metadata_xhr = $.ajax({
      url: metadata_url,
      dataType: 'json',
      success: function(data, textStatus, xhr) {
        fill_metadata(data);
      }
    });
  }

  $('#jstree-gcs-demo').jstree({
    'plugins': ['themes', 'json_data', 'ui'],
    'themes': {
      'theme': 'apple',
      'url': 'css/jstree-themes/apple/style.css',
      'dots': false,
      'icons': true
    },
    'json_data': {
      'data': data_fetch,
      'progressive_render': true
    }
  }).bind('select_node.jstree', node_clicked);

});
