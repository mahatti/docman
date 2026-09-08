from email.utils import formatdate
from pathlib import Path
from xml.sax.saxutils import escape

from flask import Response, request, send_file

from app.service import document_service

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
DAV_ALLOW = "OPTIONS, GET, HEAD, PROPFIND"


def dav_headers(etag: str | None = None, last_modified: str | None = None) -> dict[str, str]:
    headers = {
        "DAV": "1",
        "Allow": DAV_ALLOW,
        "Public": DAV_ALLOW,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
    }
    if etag:
        headers["ETag"] = etag
    if last_modified:
        headers["Last-Modified"] = last_modified
    return headers


def apply_dav_headers(response: Response, etag: str | None = None, last_modified: str | None = None) -> Response:
    for key, value in dav_headers(etag, last_modified).items():
        response.headers[key] = value
    return response


def xml_response(body: str, status: int = 200) -> Response:
    response = Response(body, status=status, mimetype="application/xml; charset=utf-8")
    return apply_dav_headers(response)


def file_meta(path: Path) -> tuple[str, str, int]:
    stat = path.stat()
    etag = f'"{stat.st_mtime_ns}-{stat.st_size}"'
    last_modified = formatdate(stat.st_mtime, usegmt=True)
    return etag, last_modified, stat.st_size


def _propfind_body(href: str, display_name: str, path: Path) -> str:
    etag, last_modified, size = file_meta(path)
    return f"""<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>{escape(href)}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>{escape(display_name)}</D:displayname>
        <D:getcontentlength>{size}</D:getcontentlength>
        <D:getcontenttype>{DOCX_MIME}</D:getcontenttype>
        <D:getetag>{escape(etag)}</D:getetag>
        <D:getlastmodified>{escape(last_modified)}</D:getlastmodified>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>
"""


def handle_word_dav(document_id: str, filename: str | None = None):
    document = document_service.get_document(document_id)
    if not document or not document.file_url:
        return xml_response("<error>Dokumen tidak ditemukan</error>", 404)

    path = Path(document.file_url)
    display_name = document.display_name
    href = request.path
    method = request.method.upper()

    if method in {"PUT", "LOCK", "UNLOCK", "PROPPATCH", "DELETE"}:
        response = xml_response("<error>Dokumen hanya bisa dibuka untuk dilihat, tidak bisa diedit.</error>", 403)
        return response

    if method == "OPTIONS":
        response = Response(status=200)
        return apply_dav_headers(response)

    if not path.exists():
        return xml_response("<error>File fisik tidak ditemukan</error>", 404)

    if method == "PROPFIND":
        return xml_response(_propfind_body(href, display_name, path), 207)

    if method in {"GET", "HEAD"}:
        etag, last_modified, _ = file_meta(path)
        response = send_file(
            path,
            mimetype=DOCX_MIME,
            as_attachment=False,
            download_name=display_name,
            etag=False,
            conditional=True,
        )
        return apply_dav_headers(response, etag, last_modified)

    response = Response(status=405)
    return apply_dav_headers(response)
