/*
 * Copyright 2012 Google, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

$(function() {

  // Used for accessing the GCS JSON API.
  var GCS_BASE_URL = 'https://www.googleapis.com/storage/v1';

  // Used for downloading the contents of a file through CORS.
  var GCS_DOWNLOAD_URL = 'http://' + GCS_BUCKET + '.storage.googleapis.com';

  // XHR request objects returned from $.ajax.
  var metadata_xhr = null;
  var contents_xhr = null;

  /*
   * Forms a URL to the GCS JSON API given a path and an optional list of query
   * parameters to include.
   */
  function make_gcs_url(path, params) {
    var query_string = '?key=' + GCS_API_KEY;
    if (params != undefined) {
      for (prop in params) {
        query_string += '&' + prop + '=' + params[prop];
      }
    }
    return GCS_BASE_URL + path + query_string;
  };

  /*
   * Converts a GCS object name to a name for showing to the user. The object
   * name from GCS's perspective is opaque, but we treat / characters as having
   * a special meaning. The display name of an object is its last component,
   * e.g. the display name of /foo/bar is just bar.
   */
  function display_name(s) {
    var i, pieces = s.split('/');
    for (i = pieces.length - 1; i >= 0; i--) {
      if (pieces[i].length > 0) {
        return pieces[i];
      }
    }
    return 'ERROR';
  };

  /*
   * Converts the GCS JSON API object listing result to jsTree JSON data format.
   * For details, see:
   *   https://developers.google.com/storage/docs/json_api/v1/objects/list
   *   http://www.jstree.com/documentation/json_data
   */
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
        results.push({'data': display_name(item.name),
                      'attr': {'gcs_id': item.name}});
      }
    }

    return results;
  };

  /*
   * Fetches the contents of a jsTree directory on-demand when requested by a
   * user clicking to expand a prefix in the tree. The initial value for the
   * root of the tree is -1. For details on the function arguments, see:
   *   http://www.jstree.com/documentation/json_data
   */
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

  /*
   * Fetches the contents of the selected file in the tree via an AJAX call to
   * the file's URL. The response can be retrieved because of CORS headers.
   */
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

  /*
   * Given the JSON metadata response about an object in GCS, places a
   * description list into the file metadata box.
   */
  function fill_metadata(data) {
    var dlstr = '<dl  class="dl-horizontal">';
    dlstr += '<dt>Content-Type</dt><dd>' + data.contentType + '</dd>';
    dlstr += '<dt>MD5</dt><dd>' + data.md5Hash + '</dd>';
    dlstr += '<dt>crc32c</dt><dd>' + data.crc32c + '</dd>';
    dlstr += '<dt>Size</dt><dd>' + data.size + '</dd>';
    dlstr += '<dt>Created</dt><dd>' + data.timeCreated + '</dd>';
    dlstr += '</dl><br/>';
    dlstr += '<center><button id="btn-fetch-file" class="btn btn-primary">' +
             'Fetch File</button></center>';
    $('#file-props').html(dlstr);
    $('#btn-fetch-file').bind('click', fetch_contents);
  }

  /*
   * Fetches metadata about a GCS object when a node in the tree is clicked.
   */
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
