import json
import os
from datetime import datetime

import openpyxl
from openpyxl.utils import get_column_letter


def safe_str(value) -> str:
    if value is None:
        return ""
    try:
        return str(value)
    except Exception:
        return repr(value)


def style_to_dict(cell) -> dict:
    font = cell.font
    fill = cell.fill
    alignment = cell.alignment
    border = cell.border
    protection = cell.protection

    return {
        "number_format": safe_str(cell.number_format),
        "font": {
            "name": font.name,
            "sz": font.sz,
            "b": font.b,
            "i": font.i,
            "u": font.u,
            "color": getattr(getattr(font, "color", None), "rgb", None),
        },
        "fill": {
            "fill_type": fill.fill_type,
            "start_color": getattr(getattr(fill, "start_color", None), "rgb", None),
            "end_color": getattr(getattr(fill, "end_color", None), "rgb", None),
        },
        "alignment": {
            "horizontal": alignment.horizontal,
            "vertical": alignment.vertical,
            "wrap_text": alignment.wrap_text,
            "text_rotation": alignment.text_rotation,
            "shrink_to_fit": alignment.shrink_to_fit,
        },
        "border": {
            "left": getattr(border.left, "style", None),
            "right": getattr(border.right, "style", None),
            "top": getattr(border.top, "style", None),
            "bottom": getattr(border.bottom, "style", None),
        },
        "protection": {
            "locked": protection.locked,
            "hidden": protection.hidden,
        },
    }


def dump_workbook_overview(wb, out_dir: str) -> None:
    overview = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "sheetnames": list(wb.sheetnames),
        "defined_names": [],
    }

    try:
        for dn in wb.defined_names.definedName:
            overview["defined_names"].append(
                {
                    "name": dn.name,
                    "attr_text": dn.attr_text,
                    "local_sheet_id": dn.localSheetId,
                    "hidden": dn.hidden,
                }
            )
    except Exception:
        pass

    with open(os.path.join(out_dir, "workbook_overview.json"), "w", encoding="utf-8") as f:
        json.dump(overview, f, ensure_ascii=False, indent=2)


def dump_sheet(ws, out_dir: str, max_rows: int, max_cols: int) -> None:
    sheet_dir = os.path.join(out_dir, f"sheet_{ws.title}")
    os.makedirs(sheet_dir, exist_ok=True)

    summary = {
        "title": ws.title,
        "max_row": ws.max_row,
        "max_column": ws.max_column,
        "merged_cells": sorted([str(rng) for rng in ws.merged_cells.ranges]),
        "row_dimensions": {},
        "column_dimensions": {},
        "data_validations": [],
        "conditional_formatting_rules": 0,
    }

    # Row/column dimensions (somente as definidas explicitamente)
    for r, dim in ws.row_dimensions.items():
        if r is None:
            continue
        summary["row_dimensions"][str(r)] = {
            "height": dim.height,
            "hidden": dim.hidden,
            "outlineLevel": dim.outlineLevel,
        }

    for col, dim in ws.column_dimensions.items():
        summary["column_dimensions"][str(col)] = {
            "width": dim.width,
            "hidden": dim.hidden,
            "outlineLevel": dim.outlineLevel,
        }

    # Data validations
    try:
        dvs = getattr(ws, "data_validations", None)
        if dvs is not None:
            for dv in dvs.dataValidation:
                summary["data_validations"].append(
                    {
                        "type": dv.type,
                        "formula1": dv.formula1,
                        "formula2": dv.formula2,
                        "allow_blank": dv.allowBlank,
                        "show_drop_down": getattr(dv, "showDropDown", None),
                        "sqref": safe_str(dv.sqref),
                    }
                )
    except Exception:
        pass

    # Conditional formatting (count only)
    try:
        cf = getattr(ws, "conditional_formatting", None)
        if cf is not None:
            # openpyxl guarda regras internamente; contar com melhor esforço
            count = 0
            for _ in cf._cf_rules.values():
                count += 1
            summary["conditional_formatting_rules"] = count
    except Exception:
        pass

    with open(os.path.join(sheet_dir, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # Dump de células (primeiros max_rows/max_cols)
    cells_dump = []
    for r in range(1, max_rows + 1):
        for c in range(1, max_cols + 1):
            cell = ws.cell(row=r, column=c)
            cells_dump.append(
                {
                    "address": f"{get_column_letter(c)}{r}",
                    "row": r,
                    "col": c,
                    "value": cell.value,
                    "data_type": cell.data_type,
                    "style": style_to_dict(cell),
                }
            )

    with open(os.path.join(sheet_dir, "cells_dump.json"), "w", encoding="utf-8") as f:
        json.dump(cells_dump, f, ensure_ascii=False, indent=2, default=safe_str)

    # Preview compacto no console (primeiras linhas, valores apenas)
    print(f"\nAba: {ws.title}")
    print(f"Dimensões: max_row={ws.max_row}, max_col={ws.max_column}")
    print(f"Merged cells: {len(summary['merged_cells'])}")
    print(f"Data validations: {len(summary['data_validations'])}")
    print(f"Conditional formatting rules: {summary['conditional_formatting_rules']}")
    print("Preview (valores):")
    headers = [get_column_letter(c) for c in range(1, max_cols + 1)]
    print("   | " + " | ".join(headers))
    for r in range(1, min(max_rows, 12) + 1):
        row_vals = [safe_str(ws.cell(r, c).value) for c in range(1, max_cols + 1)]
        print(f"{str(r).rjust(2)} | " + " | ".join(row_vals))


def inspect_xlsx(xlsx_path: str, out_dir: str, max_rows: int = 60, max_cols: int = 12) -> None:
    print("=")
    print(f"Arquivo: {xlsx_path}")

    if not os.path.exists(xlsx_path):
        print("[ERRO] Arquivo não encontrado.")
        return

    wb = openpyxl.load_workbook(xlsx_path)
    os.makedirs(out_dir, exist_ok=True)

    dump_workbook_overview(wb, out_dir)

    print("Abas:")
    for name in wb.sheetnames:
        print(f"- {name}")

    for name in wb.sheetnames:
        ws = wb[name]
        dump_sheet(ws, out_dir, max_rows=max_rows, max_cols=max_cols)

    print(f"\n[OK] Dumps gerados em: {out_dir}")


def main() -> None:
    repo_root = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(repo_root, "debug_output")

    tri_path = os.path.join(repo_root, "calendario", "CoreSport_Tri_2026.xlsx")
    inspect_xlsx(tri_path, out_dir=os.path.join(out_dir, "CoreSport_Tri_2026"), max_rows=60, max_cols=12)

    # Se quiser comparar com outro template, descomente:
    # modelo_path = os.path.join(repo_root, "calendario", "modelo final.xlsx")
    # inspect_xlsx(modelo_path, out_dir=os.path.join(out_dir, "modelo_final"), max_rows=60, max_cols=12)


if __name__ == "__main__":
    main()
