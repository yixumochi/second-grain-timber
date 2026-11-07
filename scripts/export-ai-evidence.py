"""Extract public, source-backed display data. No model, registration or solver runs.

All source locations are explicit CLI arguments. The public export contains
record names, IDs and SHA-256 digests, never workstation paths or API payloads.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('material-dir', 'defect-dir', 'audit-dir', 'bench-reference',
                 'bench-approved', 'bench-progress', 'shelter-dir', 'output-dir'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--bench-stock-audit', type=Path)
    args = parser.parse_args()
    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    provenance = []

    def source(path, record_id=None):
        row = dict(record=record_id or path.name, sha256=digest(path))
        if row not in provenance:
            provenance.append(row)
        return row

    def get(path, record_id=None):
        source(path, record_id)
        return read(path)

    images = []
    def copy(path):
        shutil.copyfile(path, out / path.name)
        row = source(path)
        images.append(dict(file=path.name, bytes=path.stat().st_size, sha256=row['sha256']))

    for filename in ('99397_photo_01.jpg', '99397_photo_02.jpg',
                     '99397_active_mask_01.png', '99397_active_mask_02.png',
                     '99397_active_mask_overlay_01.jpg', '99397_active_mask_overlay_02.jpg',
                     '99397_cloud_view_01.png', '99397_cloud_view_02.png',
                     '99397_cloud_merged.png', '99397_cloud_merged_by_view.png',
                     '99397_observed_patches_and_proxy.png'):
        copy(args.material_dir / filename)
    for filename in ('115200-source-detail.jpg', '115200-automatic-detail.jpg',
                     '115200-saved-cloud-render.png'):
        copy(args.defect_dir / filename)
    for filename in ('backing-assembled-model-render.png', 'backing-exploded-model-render.png'):
        copy(args.shelter_dir / filename)

    material = get(args.material_dir / '99397_material_record.json')
    material_manifest = get(args.material_dir / 'manifest.json', '99397/manifest.json')
    vggt = get(args.material_dir / '99397_vggt_stage.json')
    source(args.material_dir / 'README.md', '99397/README.md')
    dimensions = material['seller_reported_nominal_dimensions']
    m = dict(
        id='99397', title=material['title'], sellerUrl=material_manifest['seller_url'],
        capturedAt=dimensions['dimension_evidence']['captured_at'],
        sellerDimensionsMm={k: dimensions[k] for k in ('thickness_mm', 'width_mm', 'length_mm')},
        dimensionsBasis='Seller reported; not applied as a metric scale to the point cloud.',
        photoCount=material_manifest['photo_count'],
        pointCounts=material_manifest['per_view_counts'],
        mergedPointCount=material_manifest['retained_cloud_count'],
        masks=[dict(viewId=v['view_id'], manual=v['manual_mask'], status=v['selection_status'])
               for v in material_manifest['views']],
        vggt=dict(status=vggt['status'], finished=vggt['finished'], signature=vggt['signature']),
        stages=[
            dict(id='photos', label='Seller photographs', role='Commercial source',
                 files=['99397_photo_01.jpg', '99397_photo_02.jpg'],
                 finding='Two oblique photographs and seller dimensions begin the record.'),
            dict(id='masks', label='Isolate the timber', role='SAM2',
                 files=['99397_active_mask_overlay_01.jpg', '99397_active_mask_overlay_02.jpg'],
                 finding='Saved SAM2-derived masks isolate the visible target in each photograph; manual_mask is false.'),
            dict(id='views', label='Recover per-view support', role='VGGT + saved filtering',
                 files=['99397_cloud_view_01.png', '99397_cloud_view_02.png'],
                 finding='7,414 and 7,872 retained points preserve the contributions of the two views.'),
            dict(id='common', label='Read the common scene', role='Saved geometry visualization',
                 files=['99397_cloud_merged_by_view.png'],
                 finding='15,286 saved points share the original VGGT scene. Blue and orange reveal view provenance.'),
            dict(id='surface', label='Keep observed evidence visible', role='Photo patches + proxy',
                 files=['99397_observed_patches_and_proxy.png'],
                 finding='Observed patches remain partial; transparent and unobserved areas are not filled in.')],
        limits=[
            'Both photographs belong to listing 99397; the same physical slab has not been certified.',
            'Combined means retaining the saved VGGT common-scene alignment, not a new registration or watertight reconstruction.',
            'Both photo patches associate with one candidate proxy face; two views do not prove two physical faces.',
            'Saved CPU renders visualize evidence. No new SAM2 or VGGT execution took place for this publication.'
        ])

    scenarios = []
    for sid in ('CUT_8017f06906dc', 'CUT_f53711f9ea12'):
        p = args.defect_dir / 'scenarios' / '115200' / sid / 'revision-0001.json'
        r = get(p, sid + '/revision-0001.json')
        scenarios.append(dict(
            id=sid, status=r['status'], demandMm=r['configuration']['demands'][0]['length_mm'],
            before=r['before']['status'], after=r['after']['status'],
            bufferMm=r['configuration']['buffer_mm'],
            settings=r['configuration']['settings'], partition=r['partition'],
            afterCutting=r['after']['cutting'], currentProjectModified=r['current_project_modified'],
            demandBasis=r['configuration']['demand_basis'],
            mappingBasis=r['configuration']['anchor']['basis']))
    automatic_path = args.defect_dir / 'runs' / 'DEFECT_115200_01_37b96e7a987af96d' / 'automatic.json'
    auto = get(automatic_path, 'DEFECT_115200_01_37b96e7a987af96d/automatic.json')
    candidate = next(c for c in auto['candidates'] if c['candidate_id'] == 'C01')
    source(args.defect_dir / 'IMPLEMENTATION.md', 'timber-defect-to-cut-v1/IMPLEMENTATION.md')
    d = dict(
        id='115200', detector=auto['detector'], automaticCandidateCount=len(auto['candidates']),
        detectorRole='Classical computer vision; not a trained crack classifier or an LLM diagnosis.',
        candidateId='C01', candidateStatus=candidate['status'],
        mappedCloudPoints=candidate['mapping']['supported_points'],
        candidateReason=candidate['reason'],
        sellerLengthMm=1104.9, retainedLengthMm=828.24,
        sourceFile='115200-source-detail.jpg', detectionFile='115200-automatic-detail.jpg',
        cloudFile='115200-saved-cloud-render.png', scenarios=scenarios,
        limits=[
            'Different specimen from the 99397 two-view example.',
            '18 existing points are linked through same-view source pixels; crack depth and cross-view support remain unresolved.',
            '20 mm buffer and 3 mm kerf are research/fabrication assumptions, not a building-code crack tolerance.',
            'The 600 mm and 900 mm probes are isolated allocation experiments; neither modifies a final building allocation.'
        ])

    audit = get(args.audit_dir / 'saved_case_summary.json')
    prompts = []
    for case in audit['cases'][:3]:
        req = case['design_request']
        prompts.append(dict(
            id=case['case_id'], recordId=case['parser_record_id'], mode=case['parser_mode'],
            prompt=req['raw_prompt'], parserModel=req['parser_model'],
            hardConstraints=req['hard_constraints'], preferences=req['preferences'],
            allowedChanges=req['allowed_changes'], assumptions=req['assumptions'], unknowns=req['unknowns'],
            validation=case['validation'],
            brief={k:req['parsed_brief'][k] for k in ('location','form_description',
                   'internal_columns_allowed','jointing_allowed','stock_policy')},
            linkedRuns=case['linked_runs'],
            limit='Recorded intent parsing in a controlled pavilion experiment. Not a transcript of the later bench or shelter revisions.'
        ))

    before = get(args.bench_reference, 'GEOM_CASE2_7aedfe18d87a41a1/geometry.json')
    after = get(args.bench_approved, 'GEOM_CASE2_FULL_f7c344c7a354e884/geometry.json')
    progress = get(args.bench_progress, 'timber-case2-contour-bench/progress.json')
    before_ids = [p['part_id'] for p in before['parts']]
    after_ids = [p['part_id'] for p in after['parts']]
    assert before_ids == after_ids and len(before_ids) == 716
    assert before['summary']['overlap_contact_count'] == after['summary']['overlap_contact_count'] == 1264

    def compact_geometry(g):
        parts=[dict(id=p['part_id'],rib=p['rib_id'],y=p['y_mm'],thickness=p['thickness_mm'],
                    polygon=p['polygon_xz_mm']) for p in g['parts']]
        pts=[[v[0], y, v[1]] for p in parts for v in p['polygon']
             for y in (p['y'],p['y']+p['thickness'])]
        bounds=dict(min=[min(p[i] for p in pts) for i in range(3)],
                    max=[max(p[i] for p in pts) for i in range(3)])
        return dict(geometryId=g['geometry_id'],lengthMm=g['dimensions_mm']['length'],
                    pitchMm=g['rib_pitch_mm'],sectionMm=g['parts'][0]['source_section_mm'],
                    dimensionLabel=g['dimension_label'],bounds=bounds,parts=parts)

    geometry = dict(
        schema='SecondGrainBenchDisplayGeometry/1',
        coordinateSystem='X across bench, Y length, Z up; saved working millimetres.',
        limit='Source Blender units are unconfirmed. Both geometries use the recorded working scale of 100 mm per source unit; not physically measured.',
        derivation='Exact saved polygon_xz_mm, y_mm and thickness_mm for every corresponding member. No smoothing, morphing or new geometry generation.',
        before=compact_geometry(before), after=compact_geometry(after))
    (out/'bench-geometry.json').write_text(json.dumps(geometry,separators=(',',':'))+'\n',encoding='utf-8')
    bench = dict(
        geometryFile='bench-geometry.json',
        before={k:v for k,v in geometry['before'].items() if k!='parts'},
        after={k:v for k,v in geometry['after'].items() if k!='parts'},
        preservedMemberIds=len(before_ids),preservedContacts=1264,
        validation=progress['geometry_validation'],
        allocation={k:progress['allocation_validation'][k] for k in ('complete_allocation','demand_count',
            'assigned_blank_count','source_bar_count','material_listing_count','minimum_part_length_mm',
            'exact_section_mm','optimum_scope','structural_verification')},
        runId=progress['run_id'],allocationStatus=progress['allocation_status'],
        allocationStageModelCalls=progress['model_calls'],
        limit=geometry['limit'],
        agentAttribution='Material-driven geometry and allocation records. The saved full-bench run reports zero model calls; do not attribute this geometry change to the earlier LLM prompt experiment.')
    # Keep an actionable compact audit, without the large pairwise geometry lists.
    bench['validation']={k:bench['validation'][k] for k in ('status','source_member_count',
        'adapted_member_count','source_ids_exact','source_axes_exact','original_contact_count',
        'actual_contact_count','retained_contact_count','contact_graph_status',
        'minimum_same_layer_clearance_mm','maximum_corresponding_corner_movement_xz_mm',
        'structural_verification')}
    if args.bench_stock_audit:
        stock_audit = get(args.bench_stock_audit, 'case2/stock-audit-full.json')
        options = [[19.05, 69.85], [19.05, 82.55], [19.05, 88.9], [38.1, 88.9]]
        bench['stockCapacity'] = dict(
            scope='Necessary capacity screen within the recorded menu of at most six pieces per source bar; not a proof of global infeasibility.',
            demand=stock_audit['demand'],
            families=[{k:r[k] for k in ('section_mm','source_slot_count','source_length_mm',
                'max_parts_at_six','part_count_shortfall','necessary_capacity_pass')}
                for r in stock_audit['families_audit'] if r['section_mm'] in options])

    completion=get(args.shelter_dir/'completion.json','backing-revision-20260929/completion.json')
    geometry_audit=get(args.shelter_dir/'geometry-audit.json','backing-revision-20260929/geometry-audit.json')
    shelter=dict(
        revision=completion['project_revision'], geometryId=completion['geometry'],
        allocationId=completion['allocation'], allocationStatus=completion['allocation_status'],
        parts=completion['parts'],sourceBars=completion['source_bars'],
        analysisId=completion['analysis'],analysisStatus=completion['analysis_status'],
        caseComparison=completion['case_comparison'],
        changedMembers=geometry_audit['changed_members'],
        roofClearanceAdjustmentMm=geometry_audit['roof_clearance_adjustment_mm'],
        preservedEnclosure=geometry_audit['preserved_enclosure'],
        unchangedSuccessfulAllocation=geometry_audit['unchanged_successful_allocation'],
        physicalJointDetailsUnresolved=completion['physical_joint_details_unresolved'],
        notStructurallyVerified=completion['not_structurally_verified'],
        image='backing-assembled-model-render.png',explodedImage='backing-exploded-model-render.png',
        limits=[
            'Conceptual analysis of a saved backing revision; physical joints and foundations are not fully verified.',
            'Y-wind response improves while gravity response increases. Compare named load cases, not one universal improvement score.',
            'This revision is not asserted to be the direct output of the separate controlled prompt experiment.'
        ])
    result=dict(schema='SecondGrainAIProcessEvidence/1', publicationDate='2026-11-07',
        scope='Curated extracts and exact copies of saved local evidence; no new AI or solver execution.',
        material99397=m,defect115200=d,agentPrompts=prompts,bench=bench,shelter=shelter,
        images=images,provenance=provenance)
    body=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    assert 'C:\\' not in body and 'E:\\' not in body and '/home/' not in body
    (out/'process.json').write_text(body,encoding='utf-8')
    print(json.dumps(dict(images=len(images),imageBytes=sum(i['bytes'] for i in images),
        membersBefore=len(before_ids),membersAfter=len(after_ids),prompts=len(prompts),
        outputFiles=[p.name for p in out.iterdir()]),indent=2))


if __name__ == '__main__':
    main()
