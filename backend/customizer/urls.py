from django.urls import path

from . import views

urlpatterns = [
    path("templates/", views.EntityTemplateListView.as_view(), name="customizer-template-list"),
    path("templates/<slug:slug>/", views.EntityTemplateDetailView.as_view(), name="customizer-template-detail"),
    path("fields/", views.DynamicFieldDefinitionCreateView.as_view(), name="customizer-field-create"),
    path("fields/<int:pk>/", views.DynamicFieldDefinitionDetailView.as_view(), name="customizer-field-detail"),
]
