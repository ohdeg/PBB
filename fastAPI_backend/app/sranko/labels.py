"""Sranko clothing class labels → PBB slot / categoryCode / warmth / taxonomyGroup.

Legacy ResNet18 weights are unchanged (class_num 0–11). This module only remaps
predict outputs to the new taxonomy. User-confirmed slot / categoryCode / warmth
on saved items are the future training ground truth (image already on R2).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ClassLabel:
    class_num: int
    category1: str
    category2: str
    slot: str | None
    category_code: str | None
    rejected: bool
    warmth: int | None
    taxonomy_group: str


# Legacy ResNet18 12-class map (DigitalCloset changeString) → new taxonomy
CLASS_LABELS: dict[int, ClassLabel] = {
    0: ClassLabel(0, "상의", "긴소매", "TOP", "긴팔", False, 3, "상의-긴팔/셔츠"),
    1: ClassLabel(1, "하의", "데님팬츠", "BOTTOM", "데님", False, 3, "하의-긴바지"),
    2: ClassLabel(2, "하의", "면바지", "BOTTOM", "면바지", False, 3, "하의-긴바지"),
    3: ClassLabel(3, "상의", "민소매", "TOP", "민소매", False, 1, "상의-민소매"),
    4: ClassLabel(4, "하의", "반바지", "BOTTOM", "반바지", False, 1, "하의-반바지"),
    5: ClassLabel(5, "상의", "반소매", "TOP", "반팔", False, 2, "상의-반팔"),
    6: ClassLabel(6, "상의", "셔츠", "TOP", "셔츠", False, 3, "상의-긴팔/셔츠"),
    7: ClassLabel(7, "하의", "슬랙스", "BOTTOM", "슬랙스", False, 3, "하의-긴바지"),
    8: ClassLabel(8, "신발", "신발", "SHOES", "캐주얼", False, None, "신발"),
    9: ClassLabel(9, "옷아님", "옷아님", None, None, True, None, "옷아님"),
    # Outer heavy vs light cannot be distinguished — default light (자켓, warmth 3)
    10: ClassLabel(10, "상의", "외투", "OUTER", "자켓", False, 3, "아우터-라이트"),
    11: ClassLabel(11, "상의", "후드", "TOP", "후드", False, 4, "상의-후드/니트"),
}


def label_for(class_num: int) -> ClassLabel:
    return CLASS_LABELS.get(
        class_num,
        ClassLabel(class_num, "옷아님", "옷아님", None, None, True, None, "옷아님"),
    )
