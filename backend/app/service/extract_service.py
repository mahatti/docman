import re
from pathlib import Path

from docx import Document as DocxDocument
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

STOPWORDS = {"the", "and", "untuk", "yang", "dari", "dengan", "pada", "atau"}
GENERIC_MODULES = {"umum"}

SEGMENT_HEADING_RE = re.compile(
    r"(?im)^\s*(?:\d+(?:\.\d+)*\.?\s+)?segments?\s+([A-Z]{2,}(?:[-_][A-Za-z0-9_]+)+)\s*$"
)
SEGMENT_INLINE_RE = re.compile(
    r"(?i)\bsegments?\s+([A-Z]{2,}(?:[-_][A-Za-z0-9_]+)+)"
)
PROC_AFTER_SEGMENT_RE = re.compile(
    r"(?i)\bsegments?\s+[A-Z0-9_\-]+\s+[–—-]\s+([A-Za-z][A-Za-z0-9_]*)"
)
SQL_PROC_RE = re.compile(
    r"\b((?:usp[i]?|sp)_[A-Za-z][A-Za-z0-9_]*)\b",
    re.IGNORECASE,
)
DOC_VERSION_RE = re.compile(r"(?i)document\s+version\s+([0-9]+(?:\.[0-9]+)*)")
VERSION_TOKEN_RE = re.compile(r"^[0-9]+(?:\.[0-9]+)+$")
FILENAME_TSD_RE = re.compile(
    r"(?i)(?:^|[\s_])([A-Z]{2,})_TSD[_-]([A-Za-z0-9_]+)"
)
TITLE_AFTER_FOR_RE = re.compile(
    r"(?is)technical specification document(?:\s+for)?\s+([^\n]+)"
)


def tags_from_filename(name: str) -> list[str]:
    stem = Path(name).stem
    parts = re.split(r"[_\-\s]+", stem)
    tags = []
    seen = set()
    for part in parts:
        tag = re.sub(r"[^a-zA-Z0-9]+", "", part).lower()
        if len(tag) < 2 or tag in seen or tag in STOPWORDS:
            continue
        seen.add(tag)
        tags.append(tag)
        if len(tags) >= 6:
            break
    return tags or ["baru"]


def count_procedures(text: str) -> int:
    names = extract_procedure_names(text or "")
    if names:
        return len(names)
    numbered = re.findall(
        r"(?m)^\s*(?:\d{1,2}[\.\)]\s+\S+|(?:langkah|prosedur|procedure)\s+\d+)",
        text or "",
        flags=re.I,
    )
    labeled = re.findall(r"(?i)\b(?:prosedur|sop)\b", text or "")
    return max(len(numbered), min(len(labeled), 40))


def iter_docx_blocks(document: DocxDocument):
    body = document.element.body
    for child in body.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, document)
        elif child.tag == qn("w:tbl"):
            yield Table(child, document)


def read_docx_text(file_path: str) -> str:
    document = DocxDocument(file_path)
    lines = []
    for block in iter_docx_blocks(document):
        if isinstance(block, Paragraph):
            text = (block.text or "").strip()
            if text:
                lines.append(text)
            continue
        for row in block.rows:
            cells = [" ".join(cell.text.split()) for cell in row.cells if cell.text.strip()]
            if cells:
                lines.append(" || ".join(cells))
    return "\n".join(lines)


def read_file_text(file_path: str, file_type: str | None = None) -> str:
    ext = (file_type or Path(file_path).suffix.lstrip(".")).lower()
    if ext == "docx":
        return read_docx_text(file_path)
    if ext == "txt":
        return Path(file_path).read_text(encoding="utf-8", errors="ignore")
    if ext == "pdf":
        from pypdf import PdfReader

        reader = PdfReader(file_path)
        pages = []
        for page in reader.pages:
            pages.append((page.extract_text() or "").strip())
        return "\n".join(part for part in pages if part)
    if ext == "doc":
        raise ValueError("Format .doc lama tidak didukung. Unggah ulang sebagai .docx atau PDF.")
    raise ValueError(f"Tipe file tidak didukung: {ext}")


def _normalize_segment(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"\s+", "", value).strip(" .-_")
    cleaned = re.sub(r"\d+$", "", cleaned)
    return cleaned or None


def extract_document_code(text: str, filename: str = "") -> str | None:
    for match in SEGMENT_HEADING_RE.finditer(text or ""):
        code = _normalize_segment(match.group(1))
        if code:
            return code
    counts: dict[str, int] = {}
    for match in SEGMENT_INLINE_RE.finditer(text or ""):
        code = _normalize_segment(match.group(1))
        if not code:
            continue
        counts[code] = counts.get(code, 0) + 1
    if counts:
        return sorted(counts.items(), key=lambda item: (-item[1], -len(item[0])))[0][0]

    file_match = FILENAME_TSD_RE.search(Path(filename).stem if filename else "")
    if file_match:
        module, rest = file_match.groups()
        return f"{module}-{rest}"
    return None


def extract_module_name(document_code: str | None, text: str = "", filename: str = "") -> str | None:
    if document_code:
        return document_code.split("-", 1)[0].split("_", 1)[0].upper()
    file_match = FILENAME_TSD_RE.search(Path(filename).stem if filename else "")
    if file_match:
        return file_match.group(1).upper()
    heading = SEGMENT_HEADING_RE.search(text or "")
    if heading:
        return heading.group(1).split("-", 1)[0].upper()
    return None


def extract_version(text: str) -> str | None:
    versions = []
    in_change_control = False
    for raw_line in (text or "").splitlines():
        line = raw_line.strip()
        cells = [part.strip() for part in re.split(r"\s*\|\|\s*|\t+", line) if part.strip()]
        if cells and cells[0].lower() == "version":
            in_change_control = True
            continue
        if in_change_control:
            if not cells or not VERSION_TOKEN_RE.match(cells[0]):
                if versions:
                    break
                continue
            versions.append(cells[0])
    if versions:
        return versions[-1]
    header = DOC_VERSION_RE.search(text or "")
    if header:
        return header.group(1)
    return None


def extract_title(text: str, document_code: str | None, filename: str = "") -> str:
    if document_code:
        return f"TSD {document_code}"
    match = TITLE_AFTER_FOR_RE.search(text or "")
    if match:
        title = match.group(1).strip()
        title = re.split(r"[\n\r]", title, maxsplit=1)[0].strip()
        if title:
            return title
    if filename:
        return Path(filename).stem.replace("_", " ")
    return "TSD"


def _is_heading_like(line: str) -> bool:
    stripped = line.strip()
    if not stripped or len(stripped) > 180:
        return False
    if stripped.startswith(("http://", "https://")):
        return False
    return bool(
        re.match(r"^\d+(?:\.\d+)*", stripped)
        or re.match(r"(?i)^(data models|data flow|start procedure|list of procedures)", stripped)
        or "segment" in stripped.lower()
    )


def _canonical_procedure_names(names: list[str]) -> list[str]:
    dropped = set()
    for current in names:
        for other in names:
            if current.lower() == other.lower():
                continue
            if not current.lower().startswith(other.lower()):
                continue
            suffix = current[len(other) :]
            if not suffix.isdigit():
                continue
            if len(suffix) >= 2:
                dropped.add(current.lower())
            else:
                dropped.add(other.lower())
    return [name for name in names if name.lower() not in dropped]


def extract_procedure_names(text: str) -> list[str]:
    names: list[str] = []
    seen = set()

    def add(name: str | None):
        cleaned = (name or "").strip().strip(".-")
        if len(cleaned) < 4 or cleaned.lower() in seen:
            return
        if not re.search(r"[A-Za-z]", cleaned):
            return
        seen.add(cleaned.lower())
        names.append(cleaned)

    for match in PROC_AFTER_SEGMENT_RE.finditer(text or ""):
        add(match.group(1))

    if names:
        return _canonical_procedure_names(names)

    for line in (text or "").splitlines():
        if not _is_heading_like(line):
            continue
        for match in SQL_PROC_RE.finditer(line):
            add(match.group(1))
    return _canonical_procedure_names(names)


def extract_tsd_metadata(text: str, filename: str = "") -> dict:
    document_code = extract_document_code(text, filename)
    module_name = extract_module_name(document_code, text, filename)
    version = extract_version(text)
    procedures = extract_procedure_names(text)
    title = extract_title(text, document_code, filename)
    tags = []
    if module_name:
        tags.append(module_name.lower())
    if document_code:
        tags.append(document_code.lower())
    tags.extend(item.lower() for item in procedures[:4])
    tags.extend(tags_from_filename(filename))
    unique_tags = []
    seen = set()
    for tag in tags:
        if tag in seen or tag in GENERIC_MODULES:
            continue
        seen.add(tag)
        unique_tags.append(tag)
        if len(unique_tags) >= 8:
            break
    return {
        "title": title,
        "document_code": document_code,
        "module_name": module_name,
        "version": version,
        "procedures": procedures,
        "tags": unique_tags or tags_from_filename(filename),
    }


def extract_tsd_from_file(file_path: str, file_type: str | None = None, filename: str = "") -> dict:
    text = read_file_text(file_path, file_type)
    return extract_tsd_metadata(text, filename or Path(file_path).name)
