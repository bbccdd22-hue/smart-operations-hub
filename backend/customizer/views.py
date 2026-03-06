"""
System Customizer API – list templates, get/update template and fields, manage custom field values.
"""
from rest_framework import permissions, status, views
from rest_framework.response import Response

from core.permissions import is_super_admin

from .models import CustomFieldValue, DynamicFieldDefinition, EntityTemplate
from .serializers import (
    CustomFieldValueSerializer,
    DynamicFieldDefinitionSerializer,
    EntityTemplateSerializer,
    EntityTemplateUpdateSerializer,
)


class IsSuperAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_authenticated and is_super_admin(request.user)


class EntityTemplateListView(views.APIView):
    """GET /api/customizer/templates/ – list all templates (for Customizer dashboard)."""
    permission_classes = [IsSuperAdminOrReadOnly]

    def get(self, request):
        qs = EntityTemplate.objects.prefetch_related("field_definitions").order_by("app_label", "model_name")
        serializer = EntityTemplateSerializer(qs, many=True)
        return Response(serializer.data)


class EntityTemplateDetailView(views.APIView):
    """GET/PATCH /api/customizer/templates/<slug>/ – get or update template and its fields."""
    permission_classes = [IsSuperAdminOrReadOnly]

    def get_object(self, slug):
        return EntityTemplate.objects.prefetch_related("field_definitions").get(slug=slug)

    def get(self, request, slug):
        try:
            template = self.get_object(slug)
        except EntityTemplate.DoesNotExist:
            return Response({"detail": "Template not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = EntityTemplateSerializer(template)
        return Response(serializer.data)

    def patch(self, request, slug):
        try:
            template = self.get_object(slug)
        except EntityTemplate.DoesNotExist:
            return Response({"detail": "Template not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = EntityTemplateUpdateSerializer(template, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        if "field_definitions" in request.data:
            for item in request.data["field_definitions"]:
                fd_id = item.get("id")
                if not fd_id:
                    continue
                try:
                    fd = DynamicFieldDefinition.objects.get(id=fd_id, template=template)
                    if "order" in item:
                        fd.order = item["order"]
                    if "visible" in item:
                        fd.visible = item["visible"]
                    if "label_ar" in item:
                        fd.label_ar = item["label_ar"]
                    if "label_en" in item:
                        fd.label_en = item["label_en"]
                    if "required" in item:
                        fd.required = item["required"]
                    if "section" in item:
                        fd.section = item.get("section", "")
                    fd.save()
                except DynamicFieldDefinition.DoesNotExist:
                    pass
        out = EntityTemplateSerializer(self.get_object(slug))
        return Response(out.data)


class DynamicFieldDefinitionCreateView(views.APIView):
    """POST /api/customizer/fields/ – add a new custom field to a template."""
    permission_classes = [IsSuperAdminOrReadOnly]

    def post(self, request):
        template_id = request.data.get("template_id")
        if not template_id:
            return Response({"template_id": "Required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            template = EntityTemplate.objects.get(id=template_id)
        except EntityTemplate.DoesNotExist:
            return Response({"detail": "Template not found."}, status=status.HTTP_404_NOT_FOUND)
        data = {**request.data, "template": template_id, "is_system": False}
        serializer = DynamicFieldDefinitionSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DynamicFieldDefinitionDetailView(views.APIView):
    """PATCH/DELETE /api/customizer/fields/<id>/ – update or remove a custom field."""
    permission_classes = [IsSuperAdminOrReadOnly]

    def patch(self, request, pk):
        try:
            fd = DynamicFieldDefinition.objects.get(pk=pk)
        except DynamicFieldDefinition.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if fd.is_system:
            return Response({"detail": "System fields cannot be modified except order/visibility via template."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = DynamicFieldDefinitionSerializer(fd, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            fd = DynamicFieldDefinition.objects.get(pk=pk)
        except DynamicFieldDefinition.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)
        if fd.is_system:
            return Response({"detail": "System fields cannot be deleted."}, status=status.HTTP_400_BAD_REQUEST)
        fd.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
