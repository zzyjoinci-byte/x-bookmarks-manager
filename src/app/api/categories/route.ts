import { NextRequest, NextResponse } from "next/server";
import { getCategoryRules, addCategoryRule, deleteCategoryRule } from "@/lib/db";
import { getBuiltinRuleSummaries } from "@/lib/classifier";

export async function GET() {
  const rules = getCategoryRules();
  const builtins = getBuiltinRuleSummaries();
  return NextResponse.json({ rules, builtins });
}

export async function POST(req: NextRequest) {
  const { category, keywords, priority } = await req.json();
  if (!category || !keywords) {
    return NextResponse.json({ error: "category and keywords are required" }, { status: 400 });
  }
  addCategoryRule(category, keywords, priority || 0);
  const rules = getCategoryRules();
  const builtins = getBuiltinRuleSummaries();
  return NextResponse.json({ rules, builtins });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  deleteCategoryRule(id);
  const rules = getCategoryRules();
  const builtins = getBuiltinRuleSummaries();
  return NextResponse.json({ rules, builtins });
}
