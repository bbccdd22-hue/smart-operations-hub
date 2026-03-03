"""
Standard pagination for APIView list endpoints.
Page size: 50 default, max 100 via page_size query param.
"""
from django.core.paginator import Paginator, EmptyPage

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 100


def paginate_queryset(queryset, request, page_size=DEFAULT_PAGE_SIZE, max_page_size=MAX_PAGE_SIZE):
    """
    Paginate a queryset using page and page_size query params.
    Returns (page_items, pagination_info dict).
    """
    try:
        req_size = int(request.query_params.get("page_size", page_size))
        req_size = min(max(req_size, 1), max_page_size)
    except (TypeError, ValueError):
        req_size = page_size

    paginator = Paginator(queryset, req_size)
    try:
        page_num = int(request.query_params.get("page", 1))
        page_num = max(1, page_num)
    except (TypeError, ValueError):
        page_num = 1

    try:
        page = paginator.page(page_num)
    except EmptyPage:
        page = paginator.page(1)

    info = {
        "count": paginator.count,
        "page": page.number,
        "page_size": req_size,
        "total_pages": paginator.num_pages,
        "next": page.next_page_number() if page.has_next() else None,
        "previous": page.previous_page_number() if page.has_previous() else None,
    }
    return list(page.object_list), info
